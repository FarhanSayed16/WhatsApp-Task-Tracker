import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { recordShareSchema, validateBody } from "@/lib/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = validateBody(recordShareSchema, {
      channel: body.channel || "whatsapp_group",
      kind: "share",
      member_id: body.member_id || null,
    });

    const now = new Date().toISOString();

    // 1. Verify list exists and belongs to org
    const { data: list, error: listErr } = await supabase
      .from("task_lists")
      .select("id, status, shared_at")
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (listErr || !list) {
      return apiError("Task list not found", "NOT_FOUND", 404);
    }

    // 2. Insert into share_log
    const { error: shareLogErr } = await supabase.from("share_log").insert({
      task_list_id: id,
      kind: "share",
      channel: data.channel,
      member_id: data.member_id || null,
      created_at: now,
    });

    if (shareLogErr) throw shareLogErr;

    // 3. Update task_list shared_at if not set yet, and advance status to 'active' if draft
    const updates: Record<string, unknown> = {
      updated_at: now,
    };
    if (!list.shared_at) {
      updates.shared_at = now;
    }
    if (list.status === "draft") {
      updates.status = "active";
    }

    const { data: updatedList } = await supabase
      .from("task_lists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    return apiSuccess({
      success: true,
      shared_at: updatedList?.shared_at || now,
      status: updatedList?.status || list.status,
      channel: data.channel,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
