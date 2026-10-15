import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { id } = await params;
    const { data: template, error } = await supabase
      .from("templates")
      .select("id, name, type, body, created_by, created_at, updated_at")
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .single();

    if (error || !template) {
      return apiError("Template not found", "NOT_FOUND", 404);
    }

    return apiSuccess(template);
  } catch (error) {
    return handleApiError(error);
  }
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

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }

    if (body.body && typeof body.body === "object") {
      updates.body = body.body;
    }

    const { data: updated, error } = await supabase
      .from("templates")
      .update(updates)
      .eq("id", id)
      .eq("org_id", admin.orgId)
      .select()
      .single();

    if (error || !updated) {
      return apiError("Failed to update template", "NOT_FOUND", 404);
    }

    return apiSuccess(updated);
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
    const { error } = await supabase
      .from("templates")
      .delete()
      .eq("id", id)
      .eq("org_id", admin.orgId);

    if (error) throw error;

    return apiSuccess({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
