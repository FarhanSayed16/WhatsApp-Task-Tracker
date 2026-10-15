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

    // 2. Mark item verified
    const { data: updatedItem, error: updateErr } = await supabase
      .from("task_items")
      .update({
        status: "verified",
        verified_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 3. Mark existing completions as verified
    await supabase
      .from("completions")
      .update({
        status: "verified",
        verified_at: now,
      })
      .eq("task_item_id", id);

    // 4. Check if all items in list are complete (no item pending)
    const { data: remainingPending } = await supabase
      .from("task_items")
      .select("id")
      .eq("task_list_id", item.task_list_id)
      .eq("status", "pending")
      .limit(1);

    if (!remainingPending || remainingPending.length === 0) {
      await supabase
        .from("task_lists")
        .update({ status: "completed", updated_at: now })
        .eq("id", item.task_list_id)
        .neq("status", "archived");
    }

    return apiSuccess({
      item: updatedItem,
      verified: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
