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

    const channel =
      body.channel || (body.member_id ? "whatsapp_individual" : "whatsapp_group");

    const data = validateBody(recordShareSchema, {
      channel,
      kind: "reminder",
      member_id: body.member_id || null,
    });

    const now = new Date().toISOString();

    // Verify task list exists and belongs to org
    const { data: list, error: listErr } = await supabase
      .from("task_lists")
      .select("id")
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .single();

    if (listErr || !list) {
      return apiError("Task list not found", "NOT_FOUND", 404);
    }

    // Insert reminder record into share_log
    const { error: insertErr } = await supabase.from("share_log").insert({
      task_list_id: id,
      kind: "reminder",
      channel: data.channel,
      member_id: data.member_id || null,
      created_at: now,
    });

    if (insertErr) throw insertErr;

    return apiSuccess({
      success: true,
      logged_at: now,
      channel: data.channel,
      member_id: data.member_id || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
