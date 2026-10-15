import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { completeItemSchema } from "@/lib/validation";
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
    const result = completeItemSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid completion payload", "VALIDATION_ERROR", 400);
    }
    const { member_id, note } = result.data;
    if (!member_id) {
      return apiError("Member ID is required to complete task", "VALIDATION_ERROR", 400);
    }

    // 1. Fetch task list with group settings
    const { data: taskList, error: listError } = await supabaseAdmin
      .from("task_lists")
      .select(`
        id,
        group_id,
        list_date,
        due_at,
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

    // Check expiry
    let expiresAt: string;
    if (taskList.due_at) {
      expiresAt = taskList.due_at;
    } else {
      const listDateObj = new Date(taskList.list_date + "T23:59:59.999Z");
      expiresAt = new Date(listDateObj.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (new Date(expiresAt).getTime() < Date.now() || taskList.status === "archived") {
      return apiError("Task list is expired or read-only", "FORBIDDEN", 403);
    }

    // 2. Verify member belongs to group & is active
    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select("id, name, active, deleted_at")
      .eq("id", member_id)
      .eq("group_id", taskList.group_id)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (memberError || !member) {
      return apiError("Member not found in this group or inactive", "FORBIDDEN", 403);
    }

    // 3. Verify item belongs to this list
    const { data: item, error: itemError } = await supabaseAdmin
      .from("task_items")
      .select("id, task_list_id, status, text")
      .eq("id", id)
      .eq("task_list_id", taskList.id)
      .single();

    if (itemError || !item) {
      return apiError("Task item not found in this list", "NOT_FOUND", 404);
    }

    // 4. Check existing completions
    const { data: existingComp } = await supabaseAdmin
      .from("completions")
      .select("id, member_id, status")
      .eq("task_item_id", id)
      .maybeSingle();

    if (existingComp) {
      if (existingComp.member_id === member_id) {
        return apiSuccess({ item, message: "Item already marked done by you" });
      }
      return apiError(
        "This item was already completed by another member",
        "CONFLICT",
        409
      );
    }

    const groupInfo = Array.isArray(taskList.group) ? taskList.group[0] : taskList.group;
    const verifyRequired = Boolean(groupInfo?.verify_required);
    const targetStatus = verifyRequired ? "done" : "verified";
    const now = new Date().toISOString();

    // 5. Insert completion record
    const { error: compInsertError } = await supabaseAdmin.from("completions").insert({
      task_item_id: id,
      member_id,
      status: targetStatus,
      note: note || null,
      completed_at: now,
      verified_at: targetStatus === "verified" ? now : null,
    });

    if (compInsertError) {
      return apiError("Failed to record completion", "DB_ERROR", 500);
    }

    // 6. Update task item
    const { data: updatedItem, error: updateItemError } = await supabaseAdmin
      .from("task_items")
      .update({
        status: targetStatus,
        completed_by: member_id,
        completed_at: now,
        verified_at: targetStatus === "verified" ? now : null,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateItemError) {
      return apiError("Failed to update item status", "DB_ERROR", 500);
    }

    // 7. Check if all items in this task list are now completed
    const { data: allItems } = await supabaseAdmin
      .from("task_items")
      .select("id, status")
      .eq("task_list_id", taskList.id);

    const allFinished =
      allItems &&
      allItems.length > 0 &&
      allItems.every((it) => it.status === "done" || it.status === "verified");

    if (allFinished && taskList.status !== "completed") {
      await supabaseAdmin
        .from("task_lists")
        .update({ status: "completed", updated_at: now })
        .eq("id", taskList.id);
    }

    return apiSuccess({
      item: updatedItem,
      all_completed: Boolean(allFinished),
    });
  } catch (err: any) {
    return apiError(err.message || "Failed to complete item", "SERVER_ERROR", 500);
  }
}
