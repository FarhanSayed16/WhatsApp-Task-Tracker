import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateTaskListSchema, validateBody } from "@/lib/validation";
import { buildTaskMessage, waLink } from "@/lib/whatsapp";
import { isOverdue } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;

    // 1. Fetch task list with group
    const { data: list, error: listErr } = await supabase
      .from("task_lists")
      .select("*, group:groups(id, name, verify_required)")
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (listErr || !list) {
      return apiError("Task list not found", "NOT_FOUND", 404);
    }

    // 2. Fetch items for this list
    const { data: items, error: itemsErr } = await supabase
      .from("task_items")
      .select("*")
      .eq("task_list_id", id)
      .order("position", { ascending: true });

    if (itemsErr) throw itemsErr;
    const itemList = items || [];
    const itemIds = itemList.map((i) => i.id);

    // 3. Fetch completions
    let completionsList: any[] = [];
    if (itemIds.length > 0) {
      const { data: completions } = await supabase
        .from("completions")
        .select("*")
        .in("task_item_id", itemIds);

      completionsList = completions || [];
    }

    // 4. Fetch group members
    const { data: members } = await supabase
      .from("members")
      .select("id, name, phone, active")
      .eq("group_id", list.group_id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    // 5. Fetch share logs
    const { data: shareLogs } = await supabase
      .from("share_log")
      .select("*")
      .eq("task_list_id", id)
      .order("shared_at", { ascending: false });

    // 6. Fetch opens log
    const { data: opens } = await supabase
      .from("opens")
      .select("*, member:members(id, name)")
      .eq("task_list_id", id)
      .order("opened_at", { ascending: false });

    const baseUrl = process.env.APP_URL || APP_URL || "http://localhost:3000";
    const memberLink = `${baseUrl}/t/${list.token}`;
    const groupName = (list.group as any)?.name || "Group";

    const waText = buildTaskMessage({
      title: list.title,
      groupName,
      dateStr: list.list_date,
      dueTimeStr: list.due_at || undefined,
      items: itemList.map((i) => i.text),
      link: memberLink,
    });

    const shareUrl = waLink(waText);

    const totalItems = itemList.length;
    const completedItems = itemList.filter(
      (i) => i.status === "done" || i.status === "verified"
    ).length;
    const completionRate =
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return apiSuccess({
      task_list: {
        ...list,
        group_name: groupName,
        total_items: totalItems,
        completed_items: completedItems,
        completion_rate: completionRate,
        is_overdue: isOverdue(list.due_at, list.status),
        share_url: shareUrl,
        member_link: memberLink,
      },
      group: list.group,
      items: itemList,
      completions: completionsList,
      members: members || [],
      share_logs: shareLogs || [],
      opens: opens || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const body = await req.json();
    const data = validateBody(updateTaskListSchema, body);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.list_date !== undefined) updatePayload.list_date = data.list_date;
    if (data.due_at !== undefined) updatePayload.due_at = data.due_at;
    if (data.status !== undefined) updatePayload.status = data.status;

    const { data: updated, error } = await supabase
      .from("task_lists")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !updated) {
      return apiError("Task list not found or update failed", "NOT_FOUND", 404);
    }

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("task_lists")
      .update({
        deleted_at: now,
        status: "archived",
        updated_at: now,
      })
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (error) throw error;

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
