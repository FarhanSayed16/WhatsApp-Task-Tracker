import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateMemberSchema, validateBody } from "@/lib/validation";

async function getOrgScopedMember(memberId: string, orgId: string) {
  const { data, error } = await supabase
    .from("members")
    .select(
      `
      *,
      groups!inner (
        id,
        org_id,
        deleted_at
      )
    `
    )
    .eq("id", memberId)
    .eq("groups.org_id", orgId)
    .is("deleted_at", null)
    .is("groups.deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

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

    const existing = await getOrgScopedMember(id, admin.orgId);
    if (!existing) {
      return apiError("Member not found", "NOT_FOUND", 404);
    }

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
    const existing = await getOrgScopedMember(id, admin.orgId);
    if (!existing) {
      return apiError("Member not found", "NOT_FOUND", 404);
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("members")
      .update({
        deleted_at: now,
        active: false,
        updated_at: now,
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw error;

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
