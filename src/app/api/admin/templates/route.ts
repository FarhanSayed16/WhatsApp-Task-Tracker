import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { createTemplateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    let query = supabase
      .from("templates")
      .select("id, name, type, body, created_by, created_at, updated_at")
      .eq("org_id", admin.orgId)
      .order("updated_at", { ascending: false });

    if (type === "checklist" || type === "message") {
      query = query.eq("type", type);
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    return apiSuccess(templates || []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const result = createTemplateSchema.safeParse(body);
    if (!result.success) {
      return apiError(
        result.error.issues[0]?.message || "Invalid template data",
        "VALIDATION_ERROR",
        400
      );
    }

    const { name, type, body: templateBody } = result.data;

    // Additional validation for specific types
    if (type === "checklist" && (!templateBody.items || templateBody.items.length === 0)) {
      return apiError("Checklist template must have at least one item", "VALIDATION_ERROR", 400);
    }
    if (type === "message" && (!templateBody.text || !templateBody.text.trim())) {
      return apiError("Message template text cannot be empty", "VALIDATION_ERROR", 400);
    }

    const now = new Date().toISOString();
    const { data: template, error } = await supabase
      .from("templates")
      .insert({
        org_id: admin.orgId,
        name,
        type,
        body: templateBody,
        created_by: admin.adminId,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess(template, undefined, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
