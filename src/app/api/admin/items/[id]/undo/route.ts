import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const now = new Date().toISOString();

    // 1. Fetch item
    const { data: item, error: itemErr } = await supabase
      .from("task_items")
      .select("id, task_list_id")
      .eq("id", id)
      .single();

    if (itemErr || !item) {
      return apiError("Task item not found", "NOT_FOUND", 404);
    }

    // 2. Reset item status to pending
    const { data: updatedItem, error: updateErr } = await supabase
      .from("task_items")
      .update({
        status: "pending",
        completed_at: null,
        verified_at: null,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 3. Delete completions for this item
    await supabase.from("completions").delete().eq("task_item_id", id);

    // 4. Re-activate list if it was completed
    await supabase
      .from("task_lists")
      .update({ status: "active", updated_at: now })
      .eq("id", item.task_list_id)
      .eq("status", "completed");

    return apiSuccess({
      item: updatedItem,
      undone: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
