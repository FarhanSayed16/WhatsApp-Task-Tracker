import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { createTaskItemSchema, validateBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const data = validateBody(createTaskItemSchema, body);

    // Verify task list exists and belongs to admin org
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

    const { data: newItem, error } = await supabase
      .from("task_items")
      .insert({
        task_list_id: data.task_list_id,
        text: data.text,
        position: data.position,
        priority: data.priority || "normal",
        assigned_member_id: data.assigned_member_id || null,
        due_at: data.due_at || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess(newItem, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
