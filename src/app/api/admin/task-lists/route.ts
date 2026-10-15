import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { generateUniqueTaskToken } from "@/lib/tokens";
import { createTaskListSchema, validateBody } from "@/lib/validation";
import { buildTaskMessage, waLink } from "@/lib/whatsapp";
import { isOverdue } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("group_id");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("task_lists")
      .select("*, group:groups(id, name, verify_required)", { count: "exact" })
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (groupId) query = query.eq("group_id", groupId);
    if (status && status !== "all") query = query.eq("status", status);
    if (from) query = query.gte("list_date", from);
    if (to) query = query.lte("list_date", to);
    if (search) query = query.ilike("title", `%${search}%`);

    query = query
      .order("list_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: lists, error, count } = await query;
    if (error) throw error;

    const taskLists = lists || [];
    const listIds = taskLists.map((l) => l.id);

    // Fetch items for these task lists to compute completion and message preview
    let itemsByList: Record<
      string,
      Array<{ id: string; text: string; status: string; priority: string; due_at: string | null }>
    > = {};

    if (listIds.length > 0) {
      const { data: items } = await supabase
        .from("task_items")
        .select("id, task_list_id, text, status, priority, due_at, position")
        .in("task_list_id", listIds)
        .order("position", { ascending: true });

      if (items) {
        for (const item of items) {
          if (!itemsByList[item.task_list_id]) itemsByList[item.task_list_id] = [];
          itemsByList[item.task_list_id].push(item);
        }
      }
    }

    const baseUrl = process.env.APP_URL || APP_URL || "http://localhost:3000";

    const enrichedLists = taskLists.map((list) => {
      const items = itemsByList[list.id] || [];
      const totalItems = items.length;
      const completedItems = items.filter(
        (i) => i.status === "done" || i.status === "verified"
      ).length;

      const groupName = (list.group as any)?.name || "Group";
      const memberLink = `${baseUrl}/t/${list.token}`;

      // Build WhatsApp pre-filled message URL
      const waText = buildTaskMessage({
        title: list.title,
        groupName,
        dateStr: list.list_date,
        dueTimeStr: list.due_at || undefined,
        items: items.map((i) => i.text),
        link: memberLink,
      });

      const shareUrl = waLink(waText);

      return {
        ...list,
        group_name: groupName,
        total_items: totalItems,
        completed_items: completedItems,
        is_overdue: isOverdue(list.due_at, list.status),
        share_url: shareUrl,
        member_link: memberLink,
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return apiSuccess(enrichedLists, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const data = validateBody(createTaskListSchema, body);

    // 1. Verify group exists in admin org
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id, name")
      .eq("id", data.group_id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (groupErr || !group) {
      return apiError("Group not found", "NOT_FOUND", 404);
    }

    // 2. Generate unique 10-char token
    const token = await generateUniqueTaskToken();

    // 3. Insert task_list
    const { data: newList, error: listErr } = await supabase
      .from("task_lists")
      .insert({
        org_id: admin.orgId,
        created_by: admin.adminId,
        group_id: data.group_id,
        title: data.title,
        token,
        list_date: data.list_date,
        due_at: data.due_at || null,
        status: data.status || "draft",
      })
      .select()
      .single();

    if (listErr) throw listErr;

    // 4. Batch insert task_items
    const itemInserts = data.items.map((item, index) => {
      if (typeof item === "string") {
        return {
          task_list_id: newList.id,
          text: item,
          position: index,
          priority: "normal",
          assigned_member_id: null,
          due_at: null,
          status: "pending",
        };
      }
      return {
        task_list_id: newList.id,
        text: item.text,
        position: index,
        priority: item.priority || "normal",
        assigned_member_id: item.assigned_member_id || null,
        due_at: item.due_at || null,
        status: "pending",
      };
    });

    const { data: insertedItems, error: itemsErr } = await supabase
      .from("task_items")
      .insert(itemInserts)
      .select();

    if (itemsErr) throw itemsErr;

    return apiSuccess(
      {
        ...newList,
        items: insertedItems || [],
      },
      undefined,
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
