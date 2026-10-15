import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateTaskItemSchema, validateBody } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
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

    // 1. Get item to identify list & position
    const { data: item, error: fetchErr } = await supabase
      .from("task_items")
      .select("id, task_list_id, position")
      .eq("id", id)
      .single();

    if (fetchErr || !item) {
      return apiError("Task item not found", "NOT_FOUND", 404);
    }

    // 2. Delete completions for this item
    await supabase.from("completions").delete().eq("task_item_id", id);

    // 3. Delete item
    const { error: deleteErr } = await supabase
      .from("task_items")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    // 4. Re-sequence positions of remaining items
    const { data: remainingItems } = await supabase
      .from("task_items")
      .select("id, position")
      .eq("task_list_id", item.task_list_id)
      .order("position", { ascending: true });

    if (remainingItems) {
      for (let i = 0; i < remainingItems.length; i++) {
        if (remainingItems[i].position !== i) {
          await supabase
            .from("task_items")
            .update({ position: i })
            .eq("id", remainingItems[i].id);
        }
      }
    }

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
