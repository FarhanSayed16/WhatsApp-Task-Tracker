import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secretParam = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  const providedSecret =
    authHeader?.replace(/^Bearer\s+/i, "") || secretParam;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return apiError("Unauthorized cron trigger", "UNAUTHORIZED", 401);
  }

  const results: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Keep-alive ping to database (SELECT 1 FROM groups LIMIT 1)
    const { data: pingData, error: pingErr } = await supabase
      .from("groups")
      .select("id")
      .limit(1);

    if (pingErr) throw pingErr;
    results.dbPing = "ok";

    // 2. Clean up login attempts older than 24 hours (Review Fix #4)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: purgeErr } = await supabase
      .from("login_attempts")
      .delete()
      .lt("created_at", cutoff24h);

    results.cleaned_login_attempts = !purgeErr;

    // 3. Auto-archive task lists older than 90 days (Phase 11.2)
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

    // 4. Update daily_stats table for previous day
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Fetch all active organizations
    const { data: orgs } = await supabase.from("organizations").select("id");
    let statsUpdated = 0;

    for (const org of orgs || []) {
      // Fetch all groups for this org
      const { data: groups } = await supabase
        .from("groups")
        .select("id")
        .eq("org_id", org.id)
        .is("deleted_at", null);

      for (const grp of groups || []) {
        // Query lists for yesterday
        const { data: dayLists } = await supabase
          .from("task_lists")
          .select("id")
          .eq("org_id", org.id)
          .eq("group_id", grp.id)
          .eq("list_date", yesterdayStr)
          .is("deleted_at", null);

        const dayListIds = (dayLists || []).map((l) => l.id);

        let createdCount = 0;
        let doneCount = 0;
        let verifiedCount = 0;
        let overdueCount = 0;

        if (dayListIds.length > 0) {
          const { data: dayItems } = await supabase
            .from("task_items")
            .select("id, status, due_at")
            .in("task_list_id", dayListIds);

          const items = dayItems || [];
          createdCount = items.length;
          doneCount = items.filter(
            (i) => i.status === "done" || i.status === "verified"
          ).length;
          verifiedCount = items.filter((i) => i.status === "verified").length;
          overdueCount = items.filter(
            (i) => i.status === "pending" && i.due_at && i.due_at < yesterday.toISOString()
          ).length;
        }

        // Upsert into daily_stats
        const { error: statErr } = await supabase
          .from("daily_stats")
          .upsert(
            {
              org_id: org.id,
              group_id: grp.id,
              stat_date: yesterdayStr,
              tasks_created: createdCount,
              tasks_done: doneCount,
              tasks_verified: verifiedCount,
              tasks_overdue: overdueCount,
            },
            { onConflict: "org_id, group_id, stat_date" }
          );

        if (!statErr) statsUpdated++;
      }
    }

    results.stats_updated = statsUpdated;

    // 5. Check recurring task lists (Phase 12 readiness)
    // Find active task lists with recurrence defined
    const todayStr = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay(); // 0 is Sunday, 1 is Monday...

    const { data: recurringLists } = await supabase
      .from("task_lists")
      .select("id, org_id, group_id, title, recurrence, task_items(text, position, priority)")
      .not("recurrence", "is", null)
      .is("deleted_at", null);

    let recurringCreated = 0;
    for (const recList of recurringLists || []) {
      const rec = recList.recurrence as any;
      if (!rec) continue;

      let shouldGenerate = false;
      if (rec.freq === "daily") {
        shouldGenerate = true;
      } else if (rec.freq === "weekly" && Array.isArray(rec.days)) {
        if (rec.days.includes(dayOfWeek)) {
          shouldGenerate = true;
        }
      }

      if (rec.end_date && rec.end_date < todayStr) {
        shouldGenerate = false;
      }

      if (shouldGenerate) {
        // Check if list already generated for this group + title today
        const { data: existingToday } = await supabase
          .from("task_lists")
          .select("id")
          .eq("org_id", recList.org_id)
          .eq("group_id", recList.group_id)
          .eq("title", recList.title)
          .eq("list_date", todayStr)
          .is("deleted_at", null)
          .limit(1);

        if (!existingToday || existingToday.length === 0) {
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
            })
            .select("id")
            .single();

          if (!createListErr && newList && Array.isArray(recList.task_items)) {
            const itemsToInsert = recList.task_items.map((item: any, idx: number) => ({
              task_list_id: newList.id,
              text: item.text,
              position: idx,
              priority: item.priority || "normal",
              status: "pending",
            }));

            if (itemsToInsert.length > 0) {
              await supabase.from("task_items").insert(itemsToInsert);
            }
            recurringCreated++;
          }
        }
      }
    }

    results.recurring_created = recurringCreated;

    return apiSuccess(results);
  } catch (err) {
    return apiError(
      `Keep-alive cron encountered an error: ${String(err)}`,
      "CRON_ERROR",
      500
    );
  }
}
