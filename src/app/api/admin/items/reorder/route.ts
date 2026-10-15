import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { reorderItemsSchema, validateBody } from "@/lib/validation";

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const data = validateBody(reorderItemsSchema, body);

    // Verify task list belongs to org
    const { data: list, error: listErr } = await supabase
      .from("task_lists")
      .select("id")
      .eq("id", data.task_list_id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (listErr || !list) {
      return apiError("Task list not found", "NOT_FOUND", 404);
    }

    // Update position of each item
    for (let index = 0; index < data.ordered_ids.length; index++) {
      const itemId = data.ordered_ids[index];
      await supabase
        .from("task_items")
        .update({ position: index })
        .eq("id", itemId)
        .eq("task_list_id", data.task_list_id);
    }

    return apiSuccess({ success: true, count: data.ordered_ids.length });
  } catch (error) {
    return handleApiError(error);
  }
}
