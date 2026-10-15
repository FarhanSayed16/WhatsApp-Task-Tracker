import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { getOrgScopedItem, maybeCompleteTaskList } from "@/lib/items";

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

    if (item.status !== "done") {
      return apiError(
        "Only items marked done by a member can be verified. Use Mark Done for pending items.",
        "BAD_REQUEST",
        400
      );
    }

    const now = new Date().toISOString();

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

    await supabase
      .from("completions")
      .update({
        status: "verified",
        verified_at: now,
      })
      .eq("task_item_id", id);

    await maybeCompleteTaskList(item.task_list_id);

    return apiSuccess({
      item: updatedItem,
      verified: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
