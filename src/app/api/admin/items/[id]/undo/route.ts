import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { getOrgScopedItem } from "@/lib/items";

export async function POST(
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

    const now = new Date().toISOString();

    const { data: updatedItem, error: updateErr } = await supabase
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

    if (updateErr) throw updateErr;

    await supabase.from("completions").delete().eq("task_item_id", id);

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
