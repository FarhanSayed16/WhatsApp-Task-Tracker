import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateTaskItemSchema, validateBody } from "@/lib/validation";
import { getOrgScopedItem } from "@/lib/items";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const existing = await getOrgScopedItem(id, admin.orgId);
    if (!existing) {
      return apiError("Task item not found", "NOT_FOUND", 404);
    }

    const body = await req.json();
    const data = validateBody(updateTaskItemSchema, body);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.text !== undefined) updatePayload.text = data.text;
    if (data.position !== undefined) updatePayload.position = data.position;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.assigned_member_id !== undefined)
      updatePayload.assigned_member_id = data.assigned_member_id;
    if (data.due_at !== undefined) updatePayload.due_at = data.due_at;
    if (data.status !== undefined) updatePayload.status = data.status;

    const { data: updatedItem, error } = await supabase
      .from("task_items")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !updatedItem) {
      return apiError("Task item not found or update failed", "NOT_FOUND", 404);
    }

    return apiSuccess(updatedItem);
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
    const item = await getOrgScopedItem(id, admin.orgId);
    if (!item) {
      return apiError("Task item not found", "NOT_FOUND", 404);
    }

    await supabase.from("completions").delete().eq("task_item_id", id);

    const { error: deleteErr } = await supabase
      .from("task_items")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    const { data: remainingItems } = await supabase
      .from("task_items")
      .select("id, position")
      .eq("task_list_id", item.task_list_id)
      .order("position", { ascending: true });

    if (remainingItems && remainingItems.length > 0) {
      await Promise.all(
        remainingItems.map((row, index) =>
          supabase
            .from("task_items")
            .update({ position: index, updated_at: new Date().toISOString() })
            .eq("id", row.id)
        )
      );
    }

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
