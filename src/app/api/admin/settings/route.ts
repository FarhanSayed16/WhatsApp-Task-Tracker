import { NextRequest } from "next/server";
import { requireAdmin, createSessionToken, setSessionCookie } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { data: dbAdmin, error: adminErr } = await supabase
      .from("admin")
      .select("id, name, email, role, timezone, org_id, created_at, organization:organizations(name)")
      .eq("id", admin.adminId)
      .single();

    if (adminErr || !dbAdmin) {
      return apiError("Admin profile not found", "NOT_FOUND", 404);
    }

    // Counts for data storage indicator
    const { count: groupCount } = await supabase
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    const { count: listCount } = await supabase
      .from("task_lists")
      .select("id", { count: "exact", head: true })
      .eq("org_id", admin.orgId)
      .is("deleted_at", null);

    const { count: memberCount } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);

    const orgObj = Array.isArray(dbAdmin.organization)
      ? dbAdmin.organization[0]
      : dbAdmin.organization;

    const { data: orgData } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", admin.orgId)
      .single();

    const orgSettings = (orgData?.settings as Record<string, any>) || {};

    return apiSuccess({
      id: dbAdmin.id,
      name: dbAdmin.name,
      email: dbAdmin.email,
      role: dbAdmin.role,
      timezone: dbAdmin.timezone || "Asia/Kolkata",
      org_name: orgObj?.name || "WhatsApp Task Tracker",
      created_at: dbAdmin.created_at,
      report_digest: orgSettings.report_digest || {
        frequency: "off",
        recipients: [],
        day_of_week: 1,
      },
      stats: {
        total_groups: groupCount || 0,
        total_lists: listCount || 0,
        total_members: memberCount || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const body = await req.json();
    const { name, timezone, report_digest } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof name === "string" && name.trim().length > 0) {
      updates.name = name.trim();
    }

    if (typeof timezone === "string" && timezone.trim().length > 0) {
      updates.timezone = timezone.trim();
    }

    const { data: updatedAdmin, error: updateErr } = await supabase
      .from("admin")
      .update(updates)
      .eq("id", admin.adminId)
      .select("id, name, email, role, timezone, org_id, session_version")
      .single();

    if (updateErr || !updatedAdmin) {
      return apiError("Failed to update profile", "DB_ERROR", 500);
    }

    // If report_digest preferences provided, update organization settings
    if (report_digest && typeof report_digest === "object") {
      const { data: currentOrg } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", admin.orgId)
        .single();

      const existingSettings = (currentOrg?.settings as Record<string, any>) || {};
      await supabase
        .from("organizations")
        .update({
          settings: {
            ...existingSettings,
            report_digest: {
              ...(existingSettings.report_digest || {}),
              ...report_digest,
            },
          },
        })
        .eq("id", admin.orgId);
    }

    // Refresh JWT session cookie with updated name/timezone
    const newToken = await createSessionToken({
      sub: updatedAdmin.id,
      orgId: updatedAdmin.org_id,
      name: updatedAdmin.name,
      role: updatedAdmin.role,
      timezone: updatedAdmin.timezone,
      sessionVersion: updatedAdmin.session_version,
    });

    await setSessionCookie(newToken);

    return apiSuccess({
      message: "Preferences updated successfully",
      profile: updatedAdmin,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
