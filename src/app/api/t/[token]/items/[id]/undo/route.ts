import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";
import { checkPublicTokenRateLimit } from "@/lib/rateLimit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  if (!token || !id) return apiError("Invalid parameters", "INVALID_PARAMS", 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
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
      return apiError("Member ID is required to undo task", "VALIDATION_ERROR", 400);
    }

    // 1. Fetch task list with group settings
    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select(`
        id,
        status,
        deleted_at,
        group:groups!group_id (
          id,
          verify_required
        )
      `)
      .eq("token", token)
      .is("deleted_at", null)
      .single();

    if (listError || !taskList) {
      return apiError("Task list not found or link has expired", "NOT_FOUND", 404);
    }

    if (taskList.status === "archived") {
      return apiError("Archived task list cannot be modified", "FORBIDDEN", 403);
    }

    const groupInfo = Array.isArray(taskList.group) ? taskList.group[0] : taskList.group;
    const verifyRequired = Boolean(groupInfo?.verify_required);

    // 2. Fetch task item
    const { data: item, error: itemError } = await supabaseAdmin
      .from("task_items")
      .select("id, task_list_id, status")
      .eq("id", id)
      .eq("task_list_id", taskList.id)
      .single();

    if (itemError || !item) {
      return apiError("Task item not found in this list", "NOT_FOUND", 404);
    }

    // 3. Fetch completion
    const { data: completion, error: compError } = await supabaseAdmin
      .from("completions")
      .select("id, member_id, status")
      .eq("task_item_id", id)
      .maybeSingle();

    if (compError || !completion) {
      return apiError("Task item has not been completed yet", "BAD_REQUEST", 400);
    }

    if (completion.member_id !== member_id) {
      return apiError("Only the member who completed this task can undo it", "FORBIDDEN", 403);
    }

    if (verifyRequired && item.status === "verified") {
      return apiError(
        "This task has already been verified by the professor and cannot be undone by a member",
        "FORBIDDEN",
        403
      );
    }

    const now = new Date().toISOString();

    // 4. Delete completion record
    await supabaseAdmin
      .from("completions")
      .delete()
      .eq("id", completion.id);

    // 5. Reset task item to pending
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

    // 6. If task list was completed, revert to active
    if (taskList.status === "completed") {
      await supabaseAdmin
        .from("task_lists")
        .update({ status: "active", updated_at: now })
        .eq("id", taskList.id);
    }

    return apiSuccess({
      item: updatedItem,
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to undo task item", "SERVER_ERROR", 500);
  }
}
