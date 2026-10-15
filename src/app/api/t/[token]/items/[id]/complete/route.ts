import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { completeItemSchema } from "@/lib/validation";
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
    const result = completeItemSchema.safeParse(body);
    if (!result.success) {
      return apiError("Invalid completion payload", "VALIDATION_ERROR", 400);
    }
    const { member_id, note } = result.data;
    if (!member_id) {
      return apiError(
        "Member ID is required to complete task",
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

    const { data: member, error: memberError } = await supabaseAdmin
      .from("members")
      .select("id, name, active, deleted_at")
      .eq("id", member_id)
      .eq("group_id", taskList.group_id)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (memberError || !member) {
      return apiError(
        "Member not found in this group or inactive",
        "FORBIDDEN",
        403
      );
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from("task_items")
      .select("id, task_list_id, status, text")
      .eq("id", id)
      .eq("task_list_id", taskList.id)
      .single();

    if (itemError || !item) {
      return apiError("Task item not found in this list", "NOT_FOUND", 404);
    }

    if (item.status !== "pending") {
      return apiError(
        "This item was already completed",
        "CONFLICT",
        409
      );
    }

    const groupInfo = Array.isArray(taskList.group)
      ? taskList.group[0]
      : taskList.group;
    const verifyRequired = Boolean(groupInfo?.verify_required);
    const targetStatus = verifyRequired ? "done" : "verified";
    const now = new Date().toISOString();

    // ON CONFLICT DO NOTHING via unique (task_item_id, member_id)
    const { data: insertedComp, error: compInsertError } = await supabaseAdmin
      .from("completions")
      .insert({
        task_item_id: id,
        member_id,
        status: targetStatus,
        note: note || null,
        completed_at: now,
        verified_at: targetStatus === "verified" ? now : null,
      })
      .select("id")
      .maybeSingle();

    if (compInsertError) {
      // Unique violation → already completed
      if (
        compInsertError.code === "23505" ||
        /duplicate|unique/i.test(compInsertError.message)
      ) {
        return apiError(
          "This item was already completed",
          "CONFLICT",
          409
        );
      }
      return apiError("Failed to record completion", "DB_ERROR", 500);
    }

    if (!insertedComp) {
      return apiSuccess({ item, message: "Item already marked done" });
    }

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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to complete item";
    return apiError(message, "SERVER_ERROR", 500);
  }
}
