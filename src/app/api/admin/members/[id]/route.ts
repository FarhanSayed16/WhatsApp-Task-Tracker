import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateMemberSchema, validateBody } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const body = await req.json();
    const data = validateBody(updateMemberSchema, body);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.phone !== undefined) updatePayload.phone = data.phone;
    if (data.active !== undefined) updatePayload.active = data.active;

    const { data: updatedMember, error } = await supabase
      .from("members")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !updatedMember) {
      return apiError("Member not found or update failed", "NOT_FOUND", 404);
    }

    return apiSuccess(updatedMember);
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
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("members")
      .update({
        deleted_at: now,
        active: false,
        updated_at: now,
      })
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    if (error) throw error;

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
