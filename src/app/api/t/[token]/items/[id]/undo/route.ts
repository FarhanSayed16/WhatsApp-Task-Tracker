import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkPublicTokenRateLimit } from "@/lib/rateLimit";
import { canMemberMutateList, computeLinkStatus } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  if (!token || !id) return apiError("Invalid parameters", "INVALID_PARAMS", 400);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const rateLimit = await checkPublicTokenRateLimit(ip, token);
  if (!rateLimit.allowed) {
    return apiError(
      "Too many requests. Please wait a moment.",
      "RATE_LIMITED",
      429
    );
  }

  try {
    const body = await req.json();
    const { member_id } = body;
    if (!member_id) {
      return apiError(
        "Member ID is required to undo task",
        "VALIDATION_ERROR",
        400
      );
    }

    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select(
        `
        id,
        org_id,
        group_id,
        list_date,
        due_at,
        status,
        deleted_at,
        group:groups!group_id (
          id,
          verify_required
        )
      `
      )
      .eq("token", token)
      .maybeSingle();

    if (listError || !taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    let timeZone = DEFAULT_TIMEZONE;
    const { data: adminRow } = await supabaseAdmin
      .from("admin")
      .select("timezone")
      .eq("org_id", taskList.org_id)
      .limit(1)
      .maybeSingle();
    if (adminRow?.timezone) timeZone = adminRow.timezone;

    const { status: linkStatus } = computeLinkStatus(
      taskList.deleted_at,
      taskList.list_date,
      taskList.due_at,
      { listStatus: taskList.status, timeZone }
    );

    if (!canMemberMutateList(linkStatus)) {
      return apiError(
        "Task list is expired or read-only",
        "FORBIDDEN",
        403
      );
    }

    const groupInfo = Array.isArray(taskList.group)
      ? taskList.group[0]
      : taskList.group;
    const verifyRequired = Boolean(groupInfo?.verify_required);

    const { data: item, error: itemError } = await supabaseAdmin
      .from("task_items")
      .select("id, task_list_id, status")
      .eq("id", id)
      .eq("task_list_id", taskList.id)
      .single();

    if (itemError || !item) {
      return apiError("Task item not found in this list", "NOT_FOUND", 404);
    }

    const { data: completion, error: compError } = await supabaseAdmin
      .from("completions")
      .select("id, member_id, status")
      .eq("task_item_id", id)
      .eq("member_id", member_id)
      .maybeSingle();

    if (compError || !completion) {
      return apiError(
        "Task item has not been completed by you yet",
        "BAD_REQUEST",
        400
      );
    }

    if (verifyRequired && item.status === "verified") {
      return apiError(
        "This task has already been verified by the professor and cannot be undone by a member",
        "FORBIDDEN",
        403
      );
    }

    const now = new Date().toISOString();

    await supabaseAdmin.from("completions").delete().eq("id", completion.id);

    const { data: updatedItem, error: updateItemError } = await supabaseAdmin
      .from("task_items")
      .update({
        status: "pending",
        completed_by: null,
        completed_at: null,
        verified_at: null,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateItemError) {
      return apiError("Failed to reset item status", "DB_ERROR", 500);
    }

    if (taskList.status === "completed") {
      await supabaseAdmin
        .from("task_lists")
        .update({ status: "active", updated_at: now })
        .eq("id", taskList.id);
    }

    return apiSuccess({
      item: updatedItem,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to undo task item";
    return apiError(message, "SERVER_ERROR", 500);
  }
}
