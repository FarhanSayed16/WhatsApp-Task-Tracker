import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const groupId = searchParams.get("group_id");

    // 1. Fetch filtered task lists
    let listsQuery = supabase
      .from("task_lists")
      .select("id, title, list_date, due_at, status, group_id, group:groups(id, name)")
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .order("list_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (from) listsQuery = listsQuery.gte("list_date", from);
    if (to) listsQuery = listsQuery.lte("list_date", to);
    if (groupId) listsQuery = listsQuery.eq("group_id", groupId);

    const { data: lists, error: listsErr } = await listsQuery;
    if (listsErr) throw listsErr;

    const taskLists = lists || [];
    const listIds = taskLists.map((l) => l.id);

    // 2. Fetch items and completions
    let taskItems: Array<{
      id: string;
      task_list_id: string;
      text: string;
      priority: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
      verified_at: string | null;
      assigned_member_id: string | null;
    }> = [];

    let completions: Array<{
      task_item_id: string;
      member_id: string | null;
      note: string | null;
      status: string;
      completed_at: string | null;
      verified_at: string | null;
      member: { name: string; phone: string | null } | null;
    }> = [];

    if (listIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from("task_items")
        .select("id, task_list_id, text, priority, status, due_at, completed_at, verified_at, assigned_member_id")
        .in("task_list_id", listIds)
        .order("position", { ascending: true });

      if (itemsErr) throw itemsErr;
      taskItems = items || [];

      const itemIds = taskItems.map((i) => i.id);
      if (itemIds.length > 0) {
        const { data: comps } = await supabase
          .from("completions")
          .select("task_item_id, member_id, note, status, completed_at, verified_at, member:members(name, phone)")
          .in("task_item_id", itemIds);

        completions = (comps as any) || [];
      }
    }

    // Map list lookup
    const listMap = new Map<string, (typeof taskLists)[0]>();
    for (const l of taskLists) {
      listMap.set(l.id, l);
    }

    // Map completions by item id
    const compMap = new Map<string, (typeof completions)[0]>();
    for (const c of completions) {
      compMap.set(c.task_item_id, c);
    }

    // 3. Generate CSV rows
    const headerRow = [
      "Date",
      "Group",
      "Task List",
      "Item Text",
      "Status",
      "Priority",
      "Due Date",
      "Completed By",
      "Completed At",
      "Verified At",
      "Notes",
    ];

    const csvRows: string[] = [headerRow.map(escapeCsv).join(",")];

    for (const item of taskItems) {
      const parentList = listMap.get(item.task_list_id);
      const groupObj = Array.isArray(parentList?.group)
        ? parentList?.group[0]
        : parentList?.group;
      const comp = compMap.get(item.id);

      const groupName = groupObj?.name || "General";
      const listTitle = parentList?.title || "Untitled Checklist";
      const listDate = parentList?.list_date || "";
      const dueDate = item.due_at || parentList?.due_at || "";

      let completedByName = "";
      if (comp) {
        const memberObj = Array.isArray(comp.member) ? comp.member[0] : comp.member;
        completedByName = memberObj?.name || (comp.member_id ? "Member" : "Professor");
      }

      const completedAt = comp?.completed_at || item.completed_at || "";
      const verifiedAt = comp?.verified_at || item.verified_at || "";
      const notes = comp?.note || "";

      const row = [
        listDate,
        groupName,
        listTitle,
        item.text,
        item.status,
        item.priority,
        dueDate,
        completedByName,
        completedAt,
        verifiedAt,
        notes,
      ];

      csvRows.push(row.map(escapeCsv).join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n"); // UTF-8 BOM for Excel compatibility
    const todayStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tasks-export-${todayStr}.csv"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
