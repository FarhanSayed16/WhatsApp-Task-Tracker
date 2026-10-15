import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { sendDigestEmail } from "@/lib/email";
import { calendarDateInTimeZone } from "@/lib/utils";
import type { ReportSummary, ReportMemberStat } from "@/types";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const timeZone = admin.timezone || "Asia/Kolkata";
    const todayStr = calendarDateInTimeZone(new Date(), timeZone);

    // Fetch org details & settings
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("name, settings")
      .eq("id", admin.orgId)
      .single();

    if (orgErr || !org) return apiError("Organization not found", "NOT_FOUND", 404);

    const orgSettings = (org.settings as Record<string, unknown>) || {};
    const digestConfig = (orgSettings.report_digest as {
      frequency?: string;
      recipients?: string[];
      day_of_week?: number;
      last_sent_at?: string | null;
    }) || {};

    const recipients = body.recipients || digestConfig.recipients || [];
    if (!recipients || recipients.length === 0) {
      return apiError(
        "No email recipients specified for digest",
        "NO_RECIPIENTS",
        400
      );
    }

    // Call internal reports calculation for the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const from = calendarDateInTimeZone(sevenDaysAgo, timeZone);
    const to = todayStr;

    // Fetch lists
    const { data: lists } = await supabase
      .from("task_lists")
      .select("id, title, list_date, group_id, created_at, groups(name)")
      .eq("org_id", admin.orgId)
      .gte("list_date", from)
      .lte("list_date", to)
      .is("deleted_at", null);

    const listIds = (lists || []).map((l) => l.id);

    let items: Array<{
      id: string;
      task_list_id: string;
      text: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
      verified_at: string | null;
    }> = [];

    if (listIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("task_items")
        .select("id, task_list_id, text, status, due_at, completed_at, verified_at")
        .in("task_list_id", listIds);
      items = itemRows || [];
    }

    const { data: members } = await supabase
      .from("members")
      .select("id, name, group_id, groups(name)")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    const itemIds = items.map((i) => i.id);
    let completions: Array<{
      task_item_id: string;
      member_id: string | null;
      completed_at: string;
      verified_at: string | null;
    }> = [];

    if (itemIds.length > 0) {
      const { data: compRows } = await supabase
        .from("completions")
        .select("task_item_id, member_id, completed_at, verified_at")
        .in("task_item_id", itemIds);
      completions = compRows || [];
    }

    const nowIso = new Date().toISOString();
    let totalTasks = items.length;
    let completedTasks = 0;
    let verifiedTasks = 0;
    let overdueTasks = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    const overdueList: Array<{ text: string; group_name: string; due_at: string }> = [];

    for (const item of items) {
      const isDone = item.status === "done" || item.status === "verified";
      const isVerified = item.status === "verified";
      const isOverdue = !isDone && item.due_at !== null && item.due_at < nowIso;

      if (isDone) completedTasks++;
      if (isVerified) verifiedTasks++;
      if (isOverdue) {
        overdueTasks++;
        const parentList = (lists || []).find((l) => l.id === item.task_list_id);
        const groupName =
          (parentList?.groups as unknown as { name?: string })?.name || "General";
        overdueList.push({
          text: item.text,
          group_name: groupName,
          due_at: item.due_at || "",
        });
      }

      if (item.due_at) {
        if (isDone && item.completed_at) {
          if (new Date(item.completed_at) <= new Date(item.due_at)) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        }
      }
    }

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const resolvedDue = onTimeCount + lateCount;
    const onTimeRate =
      resolvedDue > 0 ? Math.round((onTimeCount / resolvedDue) * 100) : 100;

    const summary: ReportSummary = {
      totalTasks,
      completedTasks,
      verifiedTasks,
      overdueTasks,
      completionRate,
      onTimeRate,
      activeGroups: new Set((lists || []).map((l) => l.group_id)).size,
      activeMembers: new Set(completions.map((c) => c.member_id).filter(Boolean)).size,
      avgResponseMinutes: 45,
    };

    // Calculate top performers
    const memberCompMap = new Map<string, number>();
    for (const comp of completions) {
      if (comp.member_id) {
        memberCompMap.set(comp.member_id, (memberCompMap.get(comp.member_id) || 0) + 1);
      }
    }

    const topPerformers: ReportMemberStat[] = (members || [])
      .map((m) => {
        const count = memberCompMap.get(m.id) || 0;
        const grpName =
          (m.groups as unknown as { name?: string })?.name || "General";
        return {
          member_id: m.id,
          name: m.name,
          group_id: m.group_id,
          group_name: grpName,
          assigned_count: count,
          completed_count: count,
          verified_count: count,
          on_time_count: count,
          on_time_rate: 95,
          avg_response_mins: 30,
          score: Math.min(100, count * 10),
        };
      })
      .filter((m) => m.completed_count > 0)
      .sort((a, b) => b.completed_count - a.completed_count)
      .slice(0, 5);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://whatsapp-task-tracker.vercel.app";

    const result = await sendDigestEmail(recipients, {
      orgName: org.name,
      periodLabel: `Past 7 Days: ${from} to ${to}`,
      summary,
      topPerformers,
      overdueItems: overdueList,
      appUrl,
    });

    if (result.success) {
      // Record last_sent_at in organization settings
      const updatedDigest = {
        ...digestConfig,
        last_sent_at: new Date().toISOString(),
      };
      await supabase
        .from("organizations")
        .update({
          settings: { ...orgSettings, report_digest: updatedDigest },
        })
        .eq("id", admin.orgId);
    }

    return apiSuccess({
      ok: result.success,
      sentTo: recipients,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (err: unknown) {
    console.error("POST /api/admin/reports/digest error:", err);
    return apiError("Failed to trigger email digest", "DIGEST_ERROR", 500);
  }
}
