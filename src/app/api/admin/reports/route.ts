import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { calendarDateInTimeZone } from "@/lib/utils";
import type {
  ReportsData,
  ReportSummary,
  ReportCompletionTrend,
  ReportGroupStat,
  ReportMemberStat,
  ReportOnTimeBreakdown,
  ReportHeatmapDay,
} from "@/types";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  const { searchParams } = new URL(req.url);
  const timeZone = admin.timezone || "Asia/Kolkata";
  const todayStr = calendarDateInTimeZone(new Date(), timeZone);

  // Default: past 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const defaultFrom = calendarDateInTimeZone(thirtyDaysAgo, timeZone);

  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || todayStr;
  const groupId = searchParams.get("group_id") || undefined;
  const typeFilter = searchParams.get("type") || undefined;

  try {
    // 1. Fetch groups
    let groupsQuery = supabase
      .from("groups")
      .select("id, name")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (groupId) {
      groupsQuery = groupsQuery.eq("id", groupId);
    }

    const { data: groups, error: groupsErr } = await groupsQuery;
    if (groupsErr) throw groupsErr;

    const groupMap = new Map((groups || []).map((g) => [g.id, g.name]));

    // 2. Fetch members
    let membersQuery = supabase
      .from("members")
      .select("id, name, phone, group_id")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (groupId) {
      membersQuery = membersQuery.eq("group_id", groupId);
    }

    const { data: members, error: membersErr } = await membersQuery;
    if (membersErr) throw membersErr;

    // 3. Fetch task lists in date range
    let listsQuery = supabase
      .from("task_lists")
      .select("id, title, list_date, group_id, created_at, status")
      .eq("org_id", admin.orgId)
      .gte("list_date", from)
      .lte("list_date", to)
      .is("deleted_at", null);

    if (groupId) {
      listsQuery = listsQuery.eq("group_id", groupId);
    }

    const { data: lists, error: listsErr } = await listsQuery;
    if (listsErr) throw listsErr;

    const listMap = new Map((lists || []).map((l) => [l.id, l]));
    const listIds = (lists || []).map((l) => l.id);

    // 4. Fetch task items for matched lists
    let items: Array<{
      id: string;
      task_list_id: string;
      text: string;
      priority: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
      verified_at: string | null;
      assigned_member_id: string | null;
      created_at: string;
    }> = [];

    if (listIds.length > 0) {
      const { data: itemRows, error: itemsErr } = await supabase
        .from("task_items")
        .select("id, task_list_id, text, priority, status, due_at, completed_at, verified_at, assigned_member_id, created_at")
        .in("task_list_id", listIds);

      if (itemsErr) throw itemsErr;
      items = itemRows || [];
    }

    // 5. Fetch completions for items
    let completions: Array<{
      id: string;
      task_item_id: string;
      member_id: string | null;
      status: string;
      completed_at: string;
      verified_at: string | null;
    }> = [];

    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      const { data: compRows, error: compErr } = await supabase
        .from("completions")
        .select("id, task_item_id, member_id, status, completed_at, verified_at")
        .in("task_item_id", itemIds);

      if (compErr) throw compErr;
      completions = compRows || [];
    }

    // Map item completions
    const itemCompletionsMap = new Map<string, typeof completions>();
    for (const c of completions) {
      const existing = itemCompletionsMap.get(c.task_item_id) || [];
      existing.push(c);
      itemCompletionsMap.set(c.task_item_id, existing);
    }

    // 6. Aggregate Metrics
    const nowIso = new Date().toISOString();
    let totalTasks = items.length;
    let completedTasks = 0;
    let verifiedTasks = 0;
    let overdueTasks = 0;

    let onTimeCount = 0;
    let lateCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    const responseTimesMinutes: number[] = [];
    const activeMemberIds = new Set<string>();
    const activeGroupIds = new Set<string>();

    for (const item of items) {
      const parentList = listMap.get(item.task_list_id);
      if (parentList) activeGroupIds.add(parentList.group_id);

      const isDone = item.status === "done" || item.status === "verified";
      const isVerified = item.status === "verified";
      const isOverdue =
        !isDone && item.due_at !== null && item.due_at < nowIso;

      if (isDone) completedTasks++;
      if (isVerified) verifiedTasks++;
      if (isOverdue) overdueTasks++;

      // On-time vs Late breakdown
      if (item.due_at) {
        if (isDone && item.completed_at) {
          if (new Date(item.completed_at) <= new Date(item.due_at)) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        } else if (isOverdue) {
          overdueCount++;
        } else {
          pendingCount++;
        }
      } else {
        if (isDone) {
          onTimeCount++;
        } else {
          pendingCount++;
        }
      }

      // Calculate response time from list creation to completion
      if (isDone && item.completed_at && parentList?.created_at) {
        const diffMs =
          new Date(item.completed_at).getTime() -
          new Date(parentList.created_at).getTime();
        if (diffMs > 0) {
          responseTimesMinutes.push(Math.round(diffMs / (1000 * 60)));
        }
      }

      // Check completions for member tracking
      const itemComps = itemCompletionsMap.get(item.id) || [];
      for (const comp of itemComps) {
        if (comp.member_id) activeMemberIds.add(comp.member_id);
      }
    }

    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalResolvedWithDue = onTimeCount + lateCount;
    const onTimeRate =
      totalResolvedWithDue > 0
        ? Math.round((onTimeCount / totalResolvedWithDue) * 100)
        : 100;

    const avgResponseMinutes =
      responseTimesMinutes.length > 0
        ? Math.round(
            responseTimesMinutes.reduce((a, b) => a + b, 0) /
              responseTimesMinutes.length
          )
        : 0;

    const summary: ReportSummary = {
      totalTasks,
      completedTasks,
      verifiedTasks,
      overdueTasks,
      completionRate,
      onTimeRate,
      activeGroups: activeGroupIds.size,
      activeMembers: activeMemberIds.size,
      avgResponseMinutes,
    };

    const onTimeBreakdown: ReportOnTimeBreakdown = {
      onTime: onTimeCount,
      late: lateCount,
      pending: pendingCount,
      overdue: overdueCount,
    };

    // 7. Build Daily Completion Trends
    const trendMap = new Map<
      string,
      { created: number; done: number; verified: number; overdue: number }
    >();

    const curDate = new Date(`${from}T12:00:00Z`);
    const endDate = new Date(`${to}T12:00:00Z`);

    while (curDate <= endDate) {
      const dStr = curDate.toISOString().slice(0, 10);
      trendMap.set(dStr, { created: 0, done: 0, verified: 0, overdue: 0 });
      curDate.setUTCDate(curDate.getUTCDate() + 1);
    }

    for (const item of items) {
      const parentList = listMap.get(item.task_list_id);
      const listDate = parentList?.list_date;
      if (!listDate || !trendMap.has(listDate)) continue;

      const entry = trendMap.get(listDate)!;
      entry.created++;
      if (item.status === "done" || item.status === "verified") {
        entry.done++;
      }
      if (item.status === "verified") {
        entry.verified++;
      }
      if (item.due_at && item.status === "pending" && item.due_at < nowIso) {
        entry.overdue++;
      }
    }

    const completionTrends: ReportCompletionTrend[] = Array.from(
      trendMap.entries()
    ).map(([dStr, counts]) => {
      const rate =
        counts.created > 0
          ? Math.round((counts.done / counts.created) * 100)
          : 0;

      const parts = dStr.split("-");
      const dateObj = new Date(
        Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0)
      );
      const label = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone,
      });

      return {
        date: dStr,
        label,
        created: counts.created,
        done: counts.done,
        verified: counts.verified,
        overdue: counts.overdue,
        completionRate: rate,
      };
    });

    // 8. Group Stats
    const groupStatsMap = new Map<
      string,
      {
        total: number;
        done: number;
        verified: number;
        overdue: number;
        responseTimes: number[];
      }
    >();

    for (const g of groups || []) {
      groupStatsMap.set(g.id, {
        total: 0,
        done: 0,
        verified: 0,
        overdue: 0,
        responseTimes: [],
      });
    }

    for (const item of items) {
      const parentList = listMap.get(item.task_list_id);
      if (!parentList) continue;

      const stats = groupStatsMap.get(parentList.group_id);
      if (!stats) continue;

      stats.total++;
      const isDone = item.status === "done" || item.status === "verified";
      if (isDone) stats.done++;
      if (item.status === "verified") stats.verified++;
      if (item.due_at && item.status === "pending" && item.due_at < nowIso) {
        stats.overdue++;
      }

      if (isDone && item.completed_at && parentList.created_at) {
        const diffMs =
          new Date(item.completed_at).getTime() -
          new Date(parentList.created_at).getTime();
        if (diffMs > 0) {
          stats.responseTimes.push(Math.round(diffMs / (1000 * 60)));
        }
      }
    }

    const groupStats: ReportGroupStat[] = (groups || []).map((g) => {
      const s = groupStatsMap.get(g.id) || {
        total: 0,
        done: 0,
        verified: 0,
        overdue: 0,
        responseTimes: [],
      };
      const grpMembers = (members || []).filter((m) => m.group_id === g.id);
      const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      const avgMins =
        s.responseTimes.length > 0
          ? Math.round(
              s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length
            )
          : 0;

      return {
        group_id: g.id,
        group_name: g.name,
        total_tasks: s.total,
        completed_tasks: s.done,
        verified_tasks: s.verified,
        overdue_tasks: s.overdue,
        completion_rate: rate,
        avg_response_mins: avgMins,
        member_count: grpMembers.length,
      };
    });

    // 9. Member Performance Leaderboard
    const memberStatsMap = new Map<
      string,
      {
        assigned: number;
        completed: number;
        verified: number;
        onTime: number;
        completedWithDue: number;
        responseTimes: number[];
      }
    >();

    for (const m of members || []) {
      memberStatsMap.set(m.id, {
        assigned: 0,
        completed: 0,
        verified: 0,
        onTime: 0,
        completedWithDue: 0,
        responseTimes: [],
      });
    }

    for (const item of items) {
      const parentList = listMap.get(item.task_list_id);

      if (item.assigned_member_id && memberStatsMap.has(item.assigned_member_id)) {
        memberStatsMap.get(item.assigned_member_id)!.assigned++;
      }

      const itemComps = itemCompletionsMap.get(item.id) || [];
      for (const comp of itemComps) {
        if (!comp.member_id || !memberStatsMap.has(comp.member_id)) continue;

        const mStats = memberStatsMap.get(comp.member_id)!;
        mStats.completed++;
        if (comp.verified_at || comp.status === "verified") {
          mStats.verified++;
        }

        if (item.due_at) {
          mStats.completedWithDue++;
          if (new Date(comp.completed_at) <= new Date(item.due_at)) {
            mStats.onTime++;
          }
        }

        if (parentList?.created_at) {
          const diffMs =
            new Date(comp.completed_at).getTime() -
            new Date(parentList.created_at).getTime();
          if (diffMs > 0) {
            mStats.responseTimes.push(Math.round(diffMs / (1000 * 60)));
          }
        }
      }
    }

    const memberStats: ReportMemberStat[] = (members || []).map((m) => {
      const s = memberStatsMap.get(m.id) || {
        assigned: 0,
        completed: 0,
        verified: 0,
        onTime: 0,
        completedWithDue: 0,
        responseTimes: [],
      };

      const groupName = groupMap.get(m.group_id) || "Unknown Group";
      const onTimeRate =
        s.completedWithDue > 0
          ? Math.round((s.onTime / s.completedWithDue) * 100)
          : 100;

      const completionRate =
        s.assigned > 0
          ? Math.min(100, Math.round((s.completed / s.assigned) * 100))
          : s.completed > 0
          ? 100
          : 0;

      const verifiedRate =
        s.completed > 0 ? Math.round((s.verified / s.completed) * 100) : 0;

      const avgResponseMins =
        s.responseTimes.length > 0
          ? Math.round(
              s.responseTimes.reduce((a, b) => a + b, 0) / s.responseTimes.length
            )
          : 0;

      // Score Formula: (completionRate * 0.5) + (onTimeRate * 0.3) + (verifiedRate * 0.2)
      const score = Math.round(
        completionRate * 0.5 + onTimeRate * 0.3 + verifiedRate * 0.2
      );

      return {
        member_id: m.id,
        name: m.name,
        phone: m.phone,
        group_id: m.group_id,
        group_name: groupName,
        assigned_count: s.assigned,
        completed_count: s.completed,
        verified_count: s.verified,
        on_time_count: s.onTime,
        on_time_rate: onTimeRate,
        avg_response_mins: avgResponseMins,
        score,
      };
    });

    memberStats.sort((a, b) => b.score - a.score || b.completed_count - a.completed_count);

    // 10. Heatmap generation
    const heatmapCounts = new Map<string, number>();
    for (const comp of completions) {
      const cDate = comp.completed_at.slice(0, 10);
      heatmapCounts.set(cDate, (heatmapCounts.get(cDate) || 0) + 1);
    }

    const heatmap: ReportHeatmapDay[] = [];
    const heatCur = new Date(`${from}T12:00:00Z`);
    while (heatCur <= endDate) {
      const dStr = heatCur.toISOString().slice(0, 10);
      const count = heatmapCounts.get(dStr) || 0;
      let intensity = 0;
      if (count > 0 && count <= 2) intensity = 1;
      else if (count >= 3 && count <= 5) intensity = 2;
      else if (count >= 6 && count <= 10) intensity = 3;
      else if (count > 10) intensity = 4;

      heatmap.push({ date: dStr, count, intensity });
      heatCur.setUTCDate(heatCur.getUTCDate() + 1);
    }

    const payload: ReportsData = {
      summary,
      completionTrends,
      groupStats,
      memberStats,
      onTimeBreakdown,
      heatmap,
    };

    if (typeFilter === "completion") {
      return apiSuccess({
        summary,
        completionTrends,
        onTimeBreakdown,
      });
    }

    if (typeFilter === "member") {
      return apiSuccess({
        summary,
        memberStats,
      });
    }

    if (typeFilter === "group") {
      return apiSuccess({
        summary,
        groupStats,
      });
    }

    return apiSuccess(payload);
  } catch (err: unknown) {
    console.error("GET /api/admin/reports error:", err);
    return apiError("Failed to fetch reports analytics", "REPORTS_ERROR", 500);
  }
}
