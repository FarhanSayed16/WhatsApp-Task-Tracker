import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { apiError, apiSuccess } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secretParam = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  const providedSecret =
    authHeader?.replace(/^Bearer\s+/i, "") || secretParam;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return apiError("Unauthorized cron trigger", "UNAUTHORIZED", 401);
  }

  const results: Record<string, unknown> = {
    ping: "ok",
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Keep-alive ping to database
    const { count } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });
    results.organizationsCount = count || 0;

    // 2. Clean up login attempts older than 24 hours (Review Fix #4)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError } = await supabase
      .from("login_attempts")
      .delete()
      .lt("created_at", cutoff);

    results.cleanedLoginAttempts = !deleteError;
  } catch (err) {
    results.error = String(err);
  }

  return apiSuccess(results);
}
