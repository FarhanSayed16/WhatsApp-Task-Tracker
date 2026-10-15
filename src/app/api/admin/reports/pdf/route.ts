import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError } from "@/lib/errors";
import { calendarDateInTimeZone } from "@/lib/utils";
import { generateReportPdfBuffer } from "@/lib/pdfReport";
import type { ReportSummary, ReportGroupStat, ReportMemberStat } from "@/types";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { searchParams } = new URL(req.url);
  const timeZone = admin.timezone || "Asia/Kolkata";
  const todayStr = calendarDateInTimeZone(new Date(), timeZone);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const defaultFrom = calendarDateInTimeZone(thirtyDaysAgo, timeZone);

  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || todayStr;
  const groupId = searchParams.get("group_id") || undefined;

  try {
    // Fetch organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", admin.orgId)
      .single();

    const orgName = org?.name || "WhatsApp Task Tracker";

    // Fetch groups
    let groupsQuery = supabase
      .from("groups")
      .select("id, name")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);
    if (groupId) groupsQuery = groupsQuery.eq("id", groupId);
    const { data: groups } = await groupsQuery;
    const groupMap = new Map((groups || []).map((g) => [g.id, g.name]));

    // Fetch members
    let membersQuery = supabase
      .from("members")
      .select("id, name, group_id")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);
    if (groupId) membersQuery = membersQuery.eq("group_id", groupId);
    const { data: members } = await membersQuery;

    // Fetch lists
    let listsQuery = supabase
      .from("task_lists")
      .select("id, title, list_date, group_id, created_at, status")
      .eq("org_id", admin.orgId)
      .gte("list_date", from)
      .lte("list_date", to)
      .is("deleted_at", null);
    if (groupId) listsQuery = listsQuery.eq("group_id", groupId);
    const { data: lists } = await listsQuery;

    const listIds = (lists || []).map((l) => l.id);
    const listMap = new Map((lists || []).map((l) => [l.id, l]));

    let items: Array<{
      id: string;
      task_list_id: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
      assigned_member_id: string | null;
    }> = [];

    if (listIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("task_items")
        .select("id, task_list_id, status, due_at, completed_at, assigned_member_id")
        .in("task_list_id", listIds);
      items = itemRows || [];
    }

    const itemIds = items.map((i) => i.id);
    let completions: Array<{
      task_item_id: string;
      member_id: string | null;
      completed_at: string;
      status: string;
    }> = [];

    if (itemIds.length > 0) {
      const { data: compRows } = await supabase
        .from("completions")
        .select("task_item_id, member_id, completed_at, status")
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
    const responseTimes: number[] = [];

    for (const item of items) {
      const parent = listMap.get(item.task_list_id);
      const isDone = item.status === "done" || item.status === "verified";
      if (isDone) completedTasks++;
      if (item.status === "verified") verifiedTasks++;
      if (item.due_at && item.status === "pending" && item.due_at < nowIso) {
        overdueTasks++;
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

      if (isDone && item.completed_at && parent?.created_at) {
        const diffMs =
          new Date(item.completed_at).getTime() -
          new Date(parent.created_at).getTime();
        if (diffMs > 0) {
          responseTimes.push(Math.round(diffMs / (1000 * 60)));
        }
      }
    }

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const resolvedDue = onTimeCount + lateCount;
    const onTimeRate =
      resolvedDue > 0 ? Math.round((onTimeCount / resolvedDue) * 100) : 100;
    const avgResponseMinutes =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

    const summary: ReportSummary = {
      totalTasks,
      completedTasks,
      verifiedTasks,
      overdueTasks,
      completionRate,
      onTimeRate,
      activeGroups: new Set((lists || []).map((l) => l.group_id)).size,
      activeMembers: new Set(completions.map((c) => c.member_id).filter(Boolean)).size,
      avgResponseMinutes,
    };

    // Group breakdown
    const groupMapStats = new Map<string, { total: number; done: number; responseTimes: number[] }>();
    for (const g of groups || []) {
      groupMapStats.set(g.id, { total: 0, done: 0, responseTimes: [] });
    }
    for (const item of items) {
      const parent = listMap.get(item.task_list_id);
      if (!parent) continue;
      const s = groupMapStats.get(parent.group_id);
      if (!s) continue;
      s.total++;
      const isDone = item.status === "done" || item.status === "verified";
      if (isDone) s.done++;
      if (isDone && item.completed_at && parent.created_at) {
        const diffMs =
          new Date(item.completed_at).getTime() -
          new Date(parent.created_at).getTime();
        if (diffMs > 0) s.responseTimes.push(Math.round(diffMs / (1000 * 60)));
      }
    }

    const groupStats: ReportGroupStat[] = (groups || []).map((g) => {
      const s = groupMapStats.get(g.id) || { total: 0, done: 0, responseTimes: [] };
      const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      const avgMins =
        s.responseTimes.length > 0
          ? Math.round(s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length)
          : 0;
      return {
        group_id: g.id,
        group_name: g.name,
        total_tasks: s.total,
        completed_tasks: s.done,
        verified_tasks: 0,
        overdue_tasks: 0,
        completion_rate: rate,
        avg_response_mins: avgMins,
        member_count: (members || []).filter((m) => m.group_id === g.id).length,
      };
    });

    // Member leaderboard
    const memberCompMap = new Map<string, { completed: number; onTime: number; withDue: number }>();
    for (const m of members || []) {
      memberCompMap.set(m.id, { completed: 0, onTime: 0, withDue: 0 });
    }

    const itemDueMap = new Map(items.map((i) => [i.id, i.due_at]));
    for (const comp of completions) {
      if (!comp.member_id) continue;
      const s = memberCompMap.get(comp.member_id);
      if (!s) continue;
      s.completed++;
      const dueAt = itemDueMap.get(comp.task_item_id);
      if (dueAt) {
        s.withDue++;
        if (new Date(comp.completed_at) <= new Date(dueAt)) {
          s.onTime++;
        }
      }
    }

    const memberStats: ReportMemberStat[] = (members || []).map((m) => {
      const s = memberCompMap.get(m.id) || { completed: 0, onTime: 0, withDue: 0 };
      const groupName = groupMap.get(m.group_id) || "General";
      const onTimeRate = s.withDue > 0 ? Math.round((s.onTime / s.withDue) * 100) : 100;
      const score = Math.min(100, s.completed * 10);
      return {
        member_id: m.id,
        name: m.name,
        group_id: m.group_id,
        group_name: groupName,
        assigned_count: s.completed,
        completed_count: s.completed,
        verified_count: s.completed,
        on_time_count: s.onTime,
        on_time_rate: onTimeRate,
        avg_response_mins: 0,
        score,
      };
    });

    memberStats.sort((a, b) => b.completed_count - a.completed_count);

    const pdfBuffer = await generateReportPdfBuffer({
      orgName,
      dateRangeLabel: `${from} to ${to}`,
      generatedAt: new Date().toLocaleDateString("en-US", {
        timeZone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      summary,
      groups: groupStats,
      members: memberStats,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="task-report-${from}-to-${to}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/reports/pdf error:", err);
    return apiError("Failed to generate PDF report", "PDF_ERROR", 500);
  }
}
