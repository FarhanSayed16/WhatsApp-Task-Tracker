import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { sendDigestEmail, toReportMemberStat } from "@/lib/email";
import { calendarDateInTimeZone } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  buildOrgDigestMetrics,
  dayOfWeekInTimeZone,
  yesterdayInTimeZone,
} from "@/lib/cronHelpers";

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;

  // P0-1: Fail closed if secret is not configured
  if (!expectedSecret || expectedSecret.length < 8) {
    return apiError(
      "CRON_SECRET is not configured on the server",
      "SERVER_ERROR",
      500
    );
  }

  // P2-12: Header-only auth (no ?secret= to avoid log leakage)
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace(/^Bearer\s+/i, "") || "";

  if (providedSecret !== expectedSecret) {
    return apiError("Unauthorized cron trigger", "UNAUTHORIZED", 401);
  }

  const results: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
  };

  try {
    const { error: pingErr } = await supabase.from("groups").select("id").limit(1);
    if (pingErr) throw pingErr;
    results.dbPing = "ok";

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: purged, error: purgeErr } = await supabase
      .from("login_attempts")
      .delete()
      .lt("created_at", cutoff24h)
      .select("id");

    results.cleaned_login_attempts = purgeErr ? 0 : purged?.length || 0;

    const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: archivedLists, error: archiveErr } = await supabase
      .from("task_lists")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .lt("list_date", cutoff90d)
      .neq("status", "archived")
      .is("deleted_at", null)
      .select("id");

    results.archived_lists = archiveErr ? 0 : archivedLists?.length || 0;

    // 4. daily_stats for previous calendar day (default TZ; refine per-org below)
    const { data: orgs } = await supabase.from("organizations").select("id, settings");
    let statsUpdated = 0;

    for (const org of orgs || []) {
      const { data: adminRow } = await supabase
        .from("admin")
        .select("timezone")
        .eq("org_id", org.id)
        .limit(1)
        .maybeSingle();
      const tz = adminRow?.timezone || DEFAULT_TIMEZONE;
      const yesterdayStr = yesterdayInTimeZone(tz);

      const { data: groups } = await supabase
        .from("groups")
        .select("id")
        .eq("org_id", org.id)
        .is("deleted_at", null);

      for (const grp of groups || []) {
        const { data: dayLists } = await supabase
          .from("task_lists")
          .select("id, shared_at, created_at")
          .eq("org_id", org.id)
          .eq("group_id", grp.id)
          .eq("list_date", yesterdayStr)
          .is("deleted_at", null);

        const dayListIds = (dayLists || []).map((l) => l.id);
        const dayListMap = new Map(
          (dayLists || []).map((l) => [
            l.id,
            { shared_at: l.shared_at as string | null, created_at: l.created_at as string },
          ])
        );

        let createdCount = 0;
        let doneCount = 0;
        let verifiedCount = 0;
        let overdueCount = 0;
        const responseTimes: number[] = [];

        if (dayListIds.length > 0) {
          const { data: dayItems } = await supabase
            .from("task_items")
            .select("id, task_list_id, status, due_at, completed_at")
            .in("task_list_id", dayListIds);

          const items = dayItems || [];
          createdCount = items.length;
          doneCount = items.filter(
            (i) => i.status === "done" || i.status === "verified"
          ).length;
          verifiedCount = items.filter((i) => i.status === "verified").length;
          const yEnd = new Date(`${yesterdayStr}T23:59:59.999Z`).toISOString();
          overdueCount = items.filter(
            (i) => i.status === "pending" && i.due_at && i.due_at < yEnd
          ).length;

          for (const it of items) {
            const meta = dayListMap.get(it.task_list_id);
            const anchor = meta?.shared_at || meta?.created_at;
            if (
              (it.status === "done" || it.status === "verified") &&
              it.completed_at &&
              anchor
            ) {
              const diffMs =
                new Date(it.completed_at).getTime() - new Date(anchor).getTime();
              if (diffMs > 0) {
                responseTimes.push(Math.round(diffMs / (1000 * 60)));
              }
            }
          }
        }

        const avgResponseMinutes =
          responseTimes.length > 0
            ? Math.round(
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
              )
            : null;

        const { error: statErr } = await supabase.from("daily_stats").upsert(
          {
            org_id: org.id,
            group_id: grp.id,
            stat_date: yesterdayStr,
            tasks_created: createdCount,
            tasks_done: doneCount,
            tasks_verified: verifiedCount,
            tasks_overdue: overdueCount,
            avg_response_minutes: avgResponseMinutes,
          },
          { onConflict: "org_id,group_id,stat_date" }
        );

        if (!statErr) statsUpdated++;
      }
    }

    results.stats_updated = statsUpdated;

    // 5. Recurring task generation (org timezone + custom N-days + auto badge)
    let recurringCreated = 0;

    const { data: recurringLists } = await supabase
      .from("task_lists")
      .select(
        "id, org_id, group_id, title, list_date, recurrence, status, task_items(text, position, priority)"
      )
      .not("recurrence", "is", null)
      .is("deleted_at", null)
      .neq("status", "archived");

    // Cache org timezone
    const orgTz = new Map<string, string>();

    for (const recList of recurringLists || []) {
      const rec = recList.recurrence as Record<string, unknown> | null;
      if (!rec || rec.auto_generated) continue;

      const freq = rec.freq as string | undefined;
      if (!freq || freq === "none") continue;

      if (!orgTz.has(recList.org_id)) {
        const { data: a } = await supabase
          .from("admin")
          .select("timezone")
          .eq("org_id", recList.org_id)
          .limit(1)
          .maybeSingle();
        orgTz.set(recList.org_id, a?.timezone || DEFAULT_TIMEZONE);
      }
      const tz = orgTz.get(recList.org_id)!;
      const todayStr = calendarDateInTimeZone(new Date(), tz);
      const dow = dayOfWeekInTimeZone(new Date(), tz);

      let shouldGenerate = false;
      if (freq === "daily") {
        shouldGenerate = true;
      } else if (freq === "weekly" && Array.isArray(rec.days)) {
        shouldGenerate = (rec.days as number[]).includes(dow);
      } else if (freq === "custom") {
        const interval = Math.max(1, Number(rec.interval_days) || 1);
        const anchor = (rec.anchor_date as string) || recList.list_date;
        const anchorNoon = new Date(`${anchor}T12:00:00Z`);
        const todayNoon = new Date(`${todayStr}T12:00:00Z`);
        const diffDays = Math.round(
          (todayNoon.getTime() - anchorNoon.getTime()) / (24 * 60 * 60 * 1000)
        );
        shouldGenerate = diffDays >= 0 && diffDays % interval === 0;
      }

      const endDate = rec.end_date as string | undefined;
      if (endDate && endDate < todayStr) shouldGenerate = false;

      if (!shouldGenerate) continue;

      const { data: existingToday } = await supabase
        .from("task_lists")
        .select("id")
        .eq("org_id", recList.org_id)
        .eq("group_id", recList.group_id)
        .eq("title", recList.title)
        .eq("list_date", todayStr)
        .is("deleted_at", null)
        .limit(1);

      if (existingToday && existingToday.length > 0) continue;

      const { nanoid } = await import("nanoid");
      const token = nanoid(10);

      const { data: newList, error: createListErr } = await supabase
        .from("task_lists")
        .insert({
          org_id: recList.org_id,
          group_id: recList.group_id,
          title: recList.title,
          list_date: todayStr,
          token,
          status: "draft",
          // Marker only — no freq so cron won't regenerate from this child
          recurrence: {
            auto_generated: true,
            source: "recurrence",
            parent_list_id: recList.id,
          },
        })
        .select("id")
        .single();

      if (!createListErr && newList && Array.isArray(recList.task_items)) {
        const itemsToInsert = recList.task_items.map(
          (item: { text: string; position?: number; priority?: string }, idx: number) => ({
            task_list_id: newList.id,
            text: item.text,
            position: idx,
            priority: item.priority || "normal",
            status: "pending",
          })
        );
        if (itemsToInsert.length > 0) {
          await supabase.from("task_items").insert(itemsToInsert);
        }
        recurringCreated++;
      }
    }

    results.recurring_created = recurringCreated;

    // 6. Real digest emails
    let digestsSent = 0;
    const { data: orgsWithSettings } = await supabase
      .from("organizations")
      .select("id, name, settings");

    for (const org of orgsWithSettings || []) {
      const settings = (org.settings as Record<string, unknown>) || {};
      const digest = settings.report_digest as
        | {
            frequency?: string;
            recipients?: string[];
            last_sent_at?: string;
            day_of_week?: number;
          }
        | undefined;

      if (
        !digest ||
        digest.frequency === "off" ||
        !Array.isArray(digest.recipients) ||
        digest.recipients.length === 0
      ) {
        continue;
      }

      const { data: adminRow } = await supabase
        .from("admin")
        .select("timezone")
        .eq("org_id", org.id)
        .limit(1)
        .maybeSingle();
      const tz = adminRow?.timezone || DEFAULT_TIMEZONE;
      const curDateStr = calendarDateInTimeZone(new Date(), tz);
      const curDayOfWeek = dayOfWeekInTimeZone(new Date(), tz);

      const lastSentDate = digest.last_sent_at
        ? digest.last_sent_at.slice(0, 10)
        : null;
      if (lastSentDate === curDateStr) continue;

      let isDue = false;
      if (digest.frequency === "daily") isDue = true;
      else if (digest.frequency === "weekly") {
        const targetDay =
          typeof digest.day_of_week === "number" ? digest.day_of_week : 1;
        if (curDayOfWeek === targetDay) isDue = true;
      } else if (digest.frequency === "monthly") {
        if (Number(curDateStr.slice(8, 10)) === 1) isDue = true;
      }

      if (!isDue) continue;

      try {
        const sevenDaysAgo = (() => {
          const [y, m, d] = curDateStr.split("-").map(Number);
          const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
          noon.setUTCDate(noon.getUTCDate() - 7);
          return calendarDateInTimeZone(noon, tz);
        })();

        const metrics = await buildOrgDigestMetrics(
          supabase,
          org.id,
          sevenDaysAgo,
          curDateStr
        );

        const appUrl =
          process.env.APP_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:3000";

        const sent = await sendDigestEmail(digest.recipients, {
          orgName: org.name,
          periodLabel: `${(digest.frequency || "weekly").toUpperCase()} Digest`,
          summary: metrics.summary,
          topPerformers: metrics.topPerformers.map(toReportMemberStat),
          bottomPerformers: metrics.bottomPerformers.map(toReportMemberStat),
          overdueItems: metrics.overdueItems,
          appUrl,
        });

        if (sent.success) {
          digestsSent++;
          await supabase
            .from("organizations")
            .update({
              settings: {
                ...settings,
                report_digest: {
                  ...digest,
                  last_sent_at: new Date().toISOString(),
                },
              },
            })
            .eq("id", org.id);
        }
      } catch (e) {
        console.error("Keepalive digest email error:", e);
      }
    }

    results.digests_sent = digestsSent;
    results.cleaned = results.cleaned_login_attempts;
    results.archived = results.archived_lists;

    // 6. Flag due-soon / overdue lists for professor one-tap reminders
    let remindersFlagged = 0;
    try {
      const {
        evaluateListReminder,
        nextReminderStateAfterCronFlag,
        parseReminderSettings,
        parseReminderState,
      } = await import("@/lib/reminders");

      for (const org of orgs || []) {
        const settings = (org.settings as Record<string, unknown>) || {};
        const reminderSettings = parseReminderSettings(settings);
        if (!reminderSettings.enabled) continue;

        const { data: activeLists } = await supabase
          .from("task_lists")
          .select(
            "id, title, token, due_at, status, reminder, group_id, group:groups(name), items:task_items(status)"
          )
          .eq("org_id", org.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .not("due_at", "is", null)
          .limit(100);

        for (const list of activeLists || []) {
          const items = (list as any).items || [];
          const pending = items.filter((i: any) => i.status === "pending").length;
          const ready = evaluateListReminder(
            {
              id: list.id,
              title: list.title,
              token: list.token,
              due_at: list.due_at,
              status: list.status,
              reminder: list.reminder,
              group_id: list.group_id,
              group_name: (list as any).group?.name,
              pending_count: pending,
              total_items: items.length,
            },
            reminderSettings
          );
          if (!ready) continue;

          const current = parseReminderState(list.reminder);
          const already =
            ready.kind === "overdue"
              ? current.overdue_ready_at
              : current.due_soon_ready_at;
          if (already) continue;

          const next = nextReminderStateAfterCronFlag(current, ready.kind);
          const { error: remErr } = await supabase
            .from("task_lists")
            .update({ reminder: next, updated_at: new Date().toISOString() })
            .eq("id", list.id);

          if (!remErr) remindersFlagged++;
        }
      }
    } catch (e) {
      console.error("Keepalive reminder scan error:", e);
    }
    results.reminders_flagged = remindersFlagged;

    return apiSuccess(results);
  } catch (err) {
    return apiError(
      `Keep-alive cron encountered an error: ${String(err)}`,
      "CRON_ERROR",
      500
    );
  }
}
