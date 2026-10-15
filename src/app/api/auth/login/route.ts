import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";
import { verifyPin, createSessionToken, setSessionCookie } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  const rateCheck = await checkLoginRateLimit(ip);
  if (!rateCheck.allowed) {
    return apiError(
      `Too many failed attempts. Try again in ${Math.ceil((rateCheck.retryAfterSeconds || 900) / 60)} minutes.`,
      "RATE_LIMITED",
      429,
      { retryAfter: rateCheck.retryAfterSeconds || 900 }
    );
  }

  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return apiError(result.error.issues[0]?.message || "Invalid input", "VALIDATION_ERROR", 400);
    }

    const { pin } = result.data;

    // Fetch admin record from single-org setup
    const { data: admin, error } = await supabase
      .from("admin")
      .select("id, org_id, name, pin_hash, role, timezone, session_version")
      .limit(1)
      .single();

    if (error || !admin) {
      // Explicit opt-in only (never on production)
      if (
        process.env.ALLOW_DEV_AUTH === "true" &&
        process.env.NODE_ENV !== "production" &&
        pin === "123456"
      ) {
        const token = await createSessionToken({
          sub: "00000000-0000-0000-0000-000000000001",
          orgId: "00000000-0000-0000-0000-000000000001",
          name: "Professor",
          role: "owner",
          timezone: "Asia/Kolkata",
          sessionVersion: 1,
        });
        await setSessionCookie(token);
        return apiSuccess({ name: "Professor", role: "owner" });
      }

      await recordLoginAttempt(ip, false);
      return apiError("Invalid PIN", "INVALID_CREDENTIALS", 401);
    }

    const isMatch = await verifyPin(pin, admin.pin_hash);
    if (!isMatch) {
      await recordLoginAttempt(ip, false, admin.org_id);
      return apiError("Invalid PIN", "INVALID_CREDENTIALS", 401);
    }

    await recordLoginAttempt(ip, true, admin.org_id);

    const token = await createSessionToken({
      sub: admin.id,
      orgId: admin.org_id,
      name: admin.name,
      role: admin.role,
      timezone: admin.timezone,
      sessionVersion: admin.session_version,
    });

    await setSessionCookie(token);

    return apiSuccess({
      id: admin.id,
      name: admin.name,
      role: admin.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    return apiError("Internal server error during authentication", "SERVER_ERROR", 500);
  }
}
