import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { computeLinkStatus } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return apiError("Invalid token", "INVALID_TOKEN", 400);

  try {
    // Include soft-deleted so we can return status: expired
    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select(
        `
        id,
        org_id,
        group_id,
        title,
        list_date,
        due_at,
        token,
        status,
        deleted_at,
        group:groups!group_id (
          id,
          name,
          verify_required
        )
      `
      )
      .eq("token", token)
      .maybeSingle();

    if (listError) {
      return apiError("Failed to load task list", "DB_ERROR", 500);
    }

    if (!taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    const groupInfo = Array.isArray(taskList.group)
      ? taskList.group[0]
      : taskList.group;

    // Resolve admin timezone for list_date EOD (org's first admin)
    let timeZone = DEFAULT_TIMEZONE;
    const { data: adminRow } = await supabaseAdmin
      .from("admin")
      .select("timezone")
      .eq("org_id", taskList.org_id)
      .limit(1)
      .maybeSingle();
    if (adminRow?.timezone) timeZone = adminRow.timezone;

    const { status: computedStatus, expiresAt } = computeLinkStatus(
      taskList.deleted_at,
      taskList.list_date,
      taskList.due_at,
      { listStatus: taskList.status, timeZone }
    );

    if (computedStatus === "expired") {
      return apiSuccess({
        status: "expired",
        expires_at: expiresAt.toISOString(),
        verify_required: Boolean(groupInfo?.verify_required),
        task_list: null,
        items: [],
        members: [],
        completions: [],
      });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("task_items")
      .select(
        "id, text, position, priority, assigned_member_id, due_at, status, completed_by, completed_at, verified_at"
      )
      .eq("task_list_id", taskList.id)
      .order("position", { ascending: true });

    if (itemsError) {
      return apiError("Failed to fetch task items", "DB_ERROR", 500);
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("members")
      .select("id, name, phone, active")
      .eq("group_id", taskList.group_id)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (membersError) {
      return apiError("Failed to fetch group members", "DB_ERROR", 500);
    }

    const itemIds = (items || []).map((i) => i.id);
    let completions: unknown[] = [];
    if (itemIds.length > 0) {
      const { data: compData } = await supabaseAdmin
        .from("completions")
        .select(
          "id, task_item_id, member_id, status, note, completed_at, verified_at"
        )
        .in("task_item_id", itemIds);
      completions = compData || [];
    }

    return apiSuccess({
      status: computedStatus,
      expires_at: expiresAt.toISOString(),
      verify_required: Boolean(groupInfo?.verify_required),
      task_list: {
        id: taskList.id,
        token: taskList.token,
        title: taskList.title,
        group_name: groupInfo?.name || "Group",
        list_date: taskList.list_date,
        due_at: taskList.due_at,
        status: taskList.status,
      },
      items: items || [],
      members: members || [],
      completions,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load public task list";
    return apiError(message, "SERVER_ERROR", 500);
  }
}
