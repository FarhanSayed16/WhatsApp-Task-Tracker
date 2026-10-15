import { NextRequest } from "next/server";
import { requireAdmin, hashPin, verifyPin, createSessionToken, setSessionCookie } from "@/lib/auth";
import { changePinSchema } from "@/lib/validation";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  try {
    const body = await req.json();
    const result = changePinSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.issues[0]?.message || "Invalid input", "VALIDATION_ERROR", 400);
    }

    const { old_pin, new_pin } = result.data;

    if (old_pin === new_pin) {
      return apiError("New PIN cannot be identical to the current PIN", "SAME_PIN", 400);
    }

    // Fetch current admin hash
    const { data: dbAdmin, error: fetchErr } = await supabase
      .from("admin")
      .select("id, pin_hash, session_version, org_id, name, role, timezone")
      .eq("id", admin.adminId)
      .single();

    if (fetchErr || !dbAdmin) {
      return apiError("Admin account not found", "NOT_FOUND", 404);
    }

    const isMatch = await verifyPin(old_pin, dbAdmin.pin_hash);
    if (!isMatch) {
      return apiError("Incorrect current PIN", "INCORRECT_PIN", 400);
    }

    // Hash new PIN and bump session_version to revoke previous sessions
    const newHash = await hashPin(new_pin);
    const nextSessionVersion = (dbAdmin.session_version || 1) + 1;

    const { error: updateErr } = await supabase
      .from("admin")
      .update({
        pin_hash: newHash,
        session_version: nextSessionVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dbAdmin.id);

    if (updateErr) {
      return apiError("Failed to update PIN in database", "DB_ERROR", 500);
    }

    // Issue refreshed session cookie for the current device
    const newToken = await createSessionToken({
      sub: dbAdmin.id,
      orgId: dbAdmin.org_id,
      name: dbAdmin.name,
      role: dbAdmin.role,
      timezone: dbAdmin.timezone,
      sessionVersion: nextSessionVersion,
    });

    await setSessionCookie(newToken);

    return apiSuccess({
      message: "PIN updated successfully. All other active sessions have been revoked.",
    });
  } catch (err) {
    console.error("Change PIN error:", err);
    return apiError("Failed to process PIN change request", "SERVER_ERROR", 500);
  }
}
