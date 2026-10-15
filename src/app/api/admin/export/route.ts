import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { calendarDateInTimeZone } from "@/lib/utils";

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

const PAGE = 1000;

async function fetchAllTaskLists(
  orgId: string,
  from: string | null,
  to: string | null,
  groupId: string | null
) {
  const all: Array<Record<string, unknown>> = [];
  let fromIdx = 0;
  for (;;) {
    let q = supabase
      .from("task_lists")
      .select(
        "id, title, list_date, due_at, status, group_id, group:groups(id, name)"
      )
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("list_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(fromIdx, fromIdx + PAGE - 1);

    if (from) q = q.gte("list_date", from);
    if (to) q = q.lte("list_date", to);
    if (groupId) q = q.eq("group_id", groupId);

    const { data, error } = await q;
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    fromIdx += PAGE;
  }
  return all;
}

async function fetchAllByIds<T>(
  table: string,
  select: string,
  idColumn: string,
  ids: string[],
  order?: { column: string; ascending: boolean }
): Promise<T[]> {
  if (ids.length === 0) return [];
  const all: T[] = [];
  // Chunk `.in()` to avoid URL limits
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    let fromIdx = 0;
    for (;;) {
      let q = supabase
        .from(table)
        .select(select)
        .in(idColumn, chunk)
        .range(fromIdx, fromIdx + PAGE - 1);
      if (order) {
        q = q.order(order.column, { ascending: order.ascending });
      }
      const { data, error } = await q;
      if (error) throw error;
      const batch = (data || []) as T[];
      all.push(...batch);
      if (batch.length < PAGE) break;
      fromIdx += PAGE;
    }
  }
  return all;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const groupId = searchParams.get("group_id");

    const taskLists = await fetchAllTaskLists(
      admin.orgId,
      from,
      to,
      groupId
    );
    const listIds = taskLists.map((l) => l.id as string);

    type TaskItem = {
      id: string;
      task_list_id: string;
      text: string;
      priority: string;
      status: string;
      due_at: string | null;
      completed_at: string | null;
      verified_at: string | null;
      assigned_member_id: string | null;
    };

    type Completion = {
      task_item_id: string;
      member_id: string | null;
      note: string | null;
      status: string;
      completed_at: string | null;
      verified_at: string | null;
      member: { name: string; phone: string | null } | { name: string }[] | null;
    };

    const taskItems = await fetchAllByIds<TaskItem>(
      "task_items",
      "id, task_list_id, text, priority, status, due_at, completed_at, verified_at, assigned_member_id",
      "task_list_id",
      listIds,
      { column: "position", ascending: true }
    );

    const itemIds = taskItems.map((i) => i.id);
    const completions = await fetchAllByIds<Completion>(
      "completions",
      "task_item_id, member_id, note, status, completed_at, verified_at, member:members(name, phone)",
      "task_item_id",
      itemIds
    );

    const listMap = new Map(taskLists.map((l) => [l.id as string, l]));

    // Group completions by item (support multiple)
    const compsByItem = new Map<string, Completion[]>();
    for (const c of completions) {
      const arr = compsByItem.get(c.task_item_id) || [];
      arr.push(c);
      compsByItem.set(c.task_item_id, arr);
    }

    const headerRow = [
      "Date",
      "Group",
      "Task List",
      "Item",
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
      const parentList = listMap.get(item.task_list_id) as
        | {
            title?: string;
            list_date?: string;
            due_at?: string | null;
            group?: { name?: string } | { name?: string }[];
          }
        | undefined;
      const groupObj = Array.isArray(parentList?.group)
        ? parentList?.group[0]
        : parentList?.group;
      const groupName = groupObj?.name || "General";
      const listTitle = parentList?.title || "Untitled Checklist";
      const listDate = parentList?.list_date || "";
      const dueDate = item.due_at || parentList?.due_at || "";

      const comps = compsByItem.get(item.id) || [];

      if (comps.length === 0) {
        csvRows.push(
          [
            listDate,
            groupName,
            listTitle,
            item.text,
            item.status,
            item.priority,
            dueDate,
            "",
            item.completed_at || "",
            item.verified_at || "",
            "",
          ]
            .map(escapeCsv)
            .join(",")
        );
      } else {
        for (const comp of comps) {
          const memberObj = Array.isArray(comp.member)
            ? comp.member[0]
            : comp.member;
          const completedByName =
            memberObj?.name ||
            (comp.member_id ? "Member" : "Professor");

          csvRows.push(
            [
              listDate,
              groupName,
              listTitle,
              item.text,
              item.status,
              item.priority,
              dueDate,
              completedByName,
              comp.completed_at || item.completed_at || "",
              comp.verified_at || item.verified_at || "",
              comp.note || "",
            ]
              .map(escapeCsv)
              .join(",")
          );
        }
      }
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const todayStr = calendarDateInTimeZone(
      new Date(),
      admin.timezone || "Asia/Kolkata"
    );

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
