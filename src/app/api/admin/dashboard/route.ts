import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { calendarDateInTimeZone } from "@/lib/utils";
import type {
  DashboardData,
  DashboardKPIs,
  DashboardKPITrends,
  DashboardGroupStat,
  DashboardRecentList,
  DashboardOverdueItem,
} from "@/types";

function formatOverdueTime(dueAt: string): string {
  const diffMs = Date.now() - new Date(dueAt).getTime();
  if (diffMs <= 0) return "Due now";
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m overdue`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h overdue`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d overdue`;
}

function calcPercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("group_id") || undefined;

    // Default to today in admin timezone (list_date is a calendar date)
    const todayStr = calendarDateInTimeZone(
      new Date(),
      admin.timezone || "Asia/Kolkata"
    );
    const from = searchParams.get("from") || todayStr;
    const to = searchParams.get("to") || todayStr;

    // Calculate previous period for trends
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    const diffDays = Math.max(
      1,
      Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const prevToDateObj = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
    const prevFromDateObj = new Date(
      prevToDateObj.getTime() - (diffDays - 1) * 24 * 60 * 60 * 1000
    );

    const prevFrom = prevFromDateObj.toISOString().slice(0, 10);
    const prevTo = prevToDateObj.toISOString().slice(0, 10);

    // 1. Fetch current period task lists
    let currentListsQuery = supabase
      .from("task_lists")
      .select("id, title, token, list_date, due_at, status, recurrence, group_id, group:groups(id, name, verify_required)")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .gte("list_date", from)
      .lte("list_date", to)
      .order("list_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (groupId) {
      currentListsQuery = currentListsQuery.eq("group_id", groupId);
    }

    const { data: currentLists, error: listsErr } = await currentListsQuery;
    if (listsErr) throw listsErr;

    const listIds = (currentLists || []).map((l) => l.id);

    // 2. Fetch task items for current lists
    let currentItems: Array<{
      id: string;
      task_list_id: string;
      text: string;
      priority: string;
      status: string;
      due_at: string | null;
    }> = [];

    if (listIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from("task_items")
        .select("id, task_list_id, text, priority, status, due_at")
        .in("task_list_id", listIds);

      if (itemsErr) throw itemsErr;
      currentItems = items || [];
    }

    // 3. Fetch previous period task lists & items for trends
    let prevListsQuery = supabase
      .from("task_lists")
      .select("id")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .gte("list_date", prevFrom)
      .lte("list_date", prevTo);

    if (groupId) {
      prevListsQuery = prevListsQuery.eq("group_id", groupId);
    }

    const { data: prevLists } = await prevListsQuery;
    const prevListIds = (prevLists || []).map((l) => l.id);

    let prevItems: Array<{ status: string; due_at: string | null }> = [];
    if (prevListIds.length > 0) {
      const { data: pItems } = await supabase
        .from("task_items")
        .select("status, due_at")
        .in("task_list_id", prevListIds);
      prevItems = pItems || [];
    }

    // Compute Current KPIs
    const nowIso = new Date().toISOString();
    const totalCreated = currentItems.length;
    const totalDone = currentItems.filter((i) => i.status === "done" || i.status === "verified").length;
    const totalVerified = currentItems.filter((i) => i.status === "verified").length;
    const totalPending = currentItems.filter((i) => i.status === "pending").length;
    const totalOverdue = currentItems.filter(
      (i) => i.status === "pending" && i.due_at && i.due_at < nowIso
    ).length;
    const completionRate =
      totalCreated > 0 ? Number(((totalDone / totalCreated) * 100).toFixed(1)) : 0;

    // Compute Previous KPIs for trends
    const prevCreated = prevItems.length;
    const prevDone = prevItems.filter((i) => i.status === "done" || i.status === "verified").length;
    const prevPending = prevItems.filter((i) => i.status === "pending").length;
    const prevOverdue = prevItems.filter(
      (i) => i.status === "pending" && i.due_at && i.due_at < nowIso
    ).length;

    const trends: DashboardKPITrends = {
      created_change: calcPercentageChange(totalCreated, prevCreated),
      done_change: calcPercentageChange(totalDone, prevDone),
      pending_change: calcPercentageChange(totalPending, prevPending),
      overdue_change: calcPercentageChange(totalOverdue, prevOverdue),
    };

    const kpis: DashboardKPIs = {
      total_created: totalCreated,
      total_done: totalDone,
      total_verified: totalVerified,
      total_pending: totalPending,
      total_overdue: totalOverdue,
      completion_rate: completionRate,
      // camelCase aliases
      totalCreated,
      totalDone,
      totalVerified,
      totalPending,
      totalOverdue,
      completionRate,
    };

    // 4. Fetch all active Groups for per-group progress
    let groupsQuery = supabase
      .from("groups")
      .select("id, name, description, verify_required, members:members(id, active, deleted_at)")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (groupId) {
      groupsQuery = groupsQuery.eq("id", groupId);
    }

    const { data: allGroups, error: groupsErr } = await groupsQuery;
    if (groupsErr) throw groupsErr;

    // Fetch opens for listIds to know members_opened per group
    let opensList: Array<{ task_list_id: string; member_id: string }> = [];
    if (listIds.length > 0) {
      const { data: opensData } = await supabase
        .from("opens")
        .select("task_list_id, member_id")
        .in("task_list_id", listIds)
        .not("member_id", "is", null);
      opensList = opensData || [];
    }

    // Map items by listId for fast lookup
    const itemsByList = new Map<string, typeof currentItems>();
    for (const item of currentItems) {
      const existing = itemsByList.get(item.task_list_id) || [];
      existing.push(item);
      itemsByList.set(item.task_list_id, existing);
    }

    // Map listIds to groupId
    const listGroupMap = new Map<string, string>();
    for (const list of currentLists || []) {
      if (list.group_id) {
        listGroupMap.set(list.id, list.group_id);
      }
    }

    // Compute Per-Group Stats
    const groupStats: DashboardGroupStat[] = (allGroups || []).map((grp) => {
      // Find all lists belonging to this group
      const grpLists = (currentLists || []).filter((l) => l.group_id === grp.id);
      const grpListIds = new Set(grpLists.map((l) => l.id));

      const grpItems = currentItems.filter((i) => grpListIds.has(i.task_list_id));
      const created = grpItems.length;
      const done = grpItems.filter((i) => i.status === "done" || i.status === "verified").length;
      const pending = grpItems.filter((i) => i.status === "pending").length;
      const overdue = grpItems.filter(
        (i) => i.status === "pending" && i.due_at && i.due_at < nowIso
      ).length;
      const groupCompletionRate =
        created > 0 ? Math.round((done / created) * 100) : 0;

      // Active members in group
      const activeMembers = ((grp as any).members || []).filter(
        (m: any) => m.active && !m.deleted_at
      );
      const membersTotal = activeMembers.length;

      // Distinct members who opened
      const openedMemberIds = new Set<string>();
      for (const open of opensList) {
        if (grpListIds.has(open.task_list_id) && open.member_id) {
          openedMemberIds.add(open.member_id);
        }
      }

      return {
        id: grp.id,
        name: grp.name,
        description: grp.description,
        created,
        done,
        pending,
        overdue,
        completion_rate: groupCompletionRate,
        members_opened: openedMemberIds.size,
        members_total: membersTotal,
      };
    });

    // 5. Recent Lists / Today's Lists
    const recentLists: DashboardRecentList[] = (currentLists || []).map((list) => {
      const items = itemsByList.get(list.id) || [];
      const total = items.length;
      const completed = items.filter(
        (i) => i.status === "done" || i.status === "verified"
      ).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      const groupObj = Array.isArray(list.group) ? list.group[0] : list.group;

      const rec = list.recurrence as Record<string, unknown> | null;
      return {
        id: list.id,
        token: list.token,
        title: list.title,
        group_id: list.group_id,
        group_name: groupObj?.name || "Unknown Group",
        list_date: list.list_date,
        due_at: list.due_at,
        status: list.status as any,
        progress,
        total_items: total,
        completed_items: completed,
        recurrence: rec || null,
      };
    });

    // 6. Overdue Items (All currently active overdue items for prompt professor action)
    let overdueQuery = supabase
      .from("task_items")
      .select(`
        id,
        text,
        priority,
        due_at,
        status,
        task_list_id,
        task_list:task_lists!inner(
          id,
          title,
          token,
          org_id,
          deleted_at,
          group_id,
          group:groups!inner(id, name)
        )
      `)
      .eq("status", "pending")
      .not("due_at", "is", null)
      .lt("due_at", nowIso)
      .eq("task_list.org_id", admin.orgId)
      .is("task_list.deleted_at", null)
      .order("due_at", { ascending: true })
      .limit(20);

    if (groupId) {
      overdueQuery = overdueQuery.eq("task_list.group_id", groupId);
    }

    const { data: overdueData, error: overdueErr } = await overdueQuery;
    if (overdueErr) throw overdueErr;

    const overdueItems: DashboardOverdueItem[] = (overdueData || []).map((item: any) => {
      const taskList = item.task_list;
      const group = Array.isArray(taskList?.group) ? taskList?.group[0] : taskList?.group;

      return {
        id: item.id,
        text: item.text,
        priority: item.priority,
        due_at: item.due_at,
        status: item.status,
        task_list_id: taskList?.id || "",
        task_list_title: taskList?.title || "Untitled List",
        task_list_token: taskList?.token || "",
        group_id: group?.id || "",
        group_name: group?.name || "Unknown Group",
        time_overdue_label: formatOverdueTime(item.due_at),
      };
    });

    // 7. Items awaiting professor verification (status = done)
    let verifyQuery = supabase
      .from("task_items")
      .select(`
        id,
        text,
        priority,
        completed_at,
        completed_by,
        task_list_id,
        task_list:task_lists!inner(
          id,
          title,
          token,
          org_id,
          deleted_at,
          group_id,
          group:groups!inner(id, name)
        )
      `)
      .eq("status", "done")
      .eq("task_list.org_id", admin.orgId)
      .is("task_list.deleted_at", null)
      .order("completed_at", { ascending: false })
      .limit(20);

    if (groupId) {
      verifyQuery = verifyQuery.eq("task_list.group_id", groupId);
    }

    const { data: verifyData } = await verifyQuery;

    const verifierIds = [
      ...new Set(
        (verifyData || [])
          .map((i: { completed_by?: string | null }) => i.completed_by)
          .filter(Boolean) as string[]
      ),
    ];
    const verifierNames: Record<string, string> = {};
    if (verifierIds.length > 0) {
      const { data: verifiers } = await supabase
        .from("members")
        .select("id, name")
        .in("id", verifierIds);
      for (const m of verifiers || []) {
        verifierNames[m.id] = m.name;
      }
    }

    const pendingVerifyItems = (verifyData || []).map((item: any) => {
      const taskList = item.task_list;
      const group = Array.isArray(taskList?.group) ? taskList?.group[0] : taskList?.group;

      return {
        id: item.id,
        text: item.text,
        priority: item.priority,
        completed_at: item.completed_at,
        task_list_id: taskList?.id || "",
        task_list_title: taskList?.title || "Untitled List",
        task_list_token: taskList?.token || "",
        group_id: group?.id || "",
        group_name: group?.name || "Unknown Group",
        completed_by_name: item.completed_by
          ? verifierNames[item.completed_by] || null
          : null,
      };
    });

    const responseData: DashboardData = {
      kpis,
      trends,
      groups: groupStats,
      recent_lists: recentLists,
      overdue_items: overdueItems,
      pending_verify_items: pendingVerifyItems,
      todayLists: recentLists,
    };

    return apiSuccess(responseData);
  } catch (error) {
    return handleApiError(error);
  }
}
