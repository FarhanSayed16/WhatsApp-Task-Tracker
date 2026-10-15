import { supabase } from "./supabase";
import { LOGIN_RATE_LIMIT, PUBLIC_API_RATE_LIMIT } from "./constants";

// In-memory fallback if database is not reachable during initial development
const memoryAttempts = new Map<string, { count: number; resetAt: number }>();
const publicTokenAttempts = new Map<string, { count: number; resetAt: number }>();

export async function checkLoginRateLimit(ip: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}> {
  try {
    const windowStart = new Date(
      Date.now() - LOGIN_RATE_LIMIT.WINDOW_MINUTES * 60 * 1000
    ).toISOString();

    // 1. Check IP-specific rate limit (max 5 in 15 min)
    const { count, error } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", windowStart);

    if (error) throw error;

    const failedCount = count || 0;
    const remaining = Math.max(0, LOGIN_RATE_LIMIT.MAX_ATTEMPTS - failedCount);

    if (failedCount >= LOGIN_RATE_LIMIT.MAX_ATTEMPTS) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: LOGIN_RATE_LIMIT.WINDOW_MINUTES * 60,
      };
    }

    // 2. Check global rate limit: max 30 failed attempts in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: globalFailedCount } = await supabase
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("success", false)
      .gte("created_at", oneHourAgo);

    if (globalFailedCount && globalFailedCount >= 30) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: 60 * 15,
      };
    }

    return {
      allowed: true,
      remainingAttempts: remaining,
    };
  } catch (err) {
    console.warn("DB rate-limit lookup failed, using fallback:", err);
    // In-memory fallback
    const now = Date.now();
    const entry = memoryAttempts.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= LOGIN_RATE_LIMIT.MAX_ATTEMPTS) {
        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
        };
      }
      return {
        allowed: true,
        remainingAttempts: LOGIN_RATE_LIMIT.MAX_ATTEMPTS - entry.count,
      };
    }
    return {
      allowed: true,
      remainingAttempts: LOGIN_RATE_LIMIT.MAX_ATTEMPTS,
    };
  }
}

export async function recordLoginAttempt(
  ip: string,
  success: boolean,
  orgId?: string | null
): Promise<void> {
  // Always update in-memory record first (works even if DB insert fails)
  const now = Date.now();
  const resetAt = now + LOGIN_RATE_LIMIT.WINDOW_MINUTES * 60 * 1000;
  if (!success) {
    const current = memoryAttempts.get(ip);
    if (current && current.resetAt > now) {
      current.count += 1;
    } else {
      memoryAttempts.set(ip, { count: 1, resetAt });
    }
  } else {
    memoryAttempts.delete(ip);
  }

  const { error } = await supabase.from("login_attempts").insert({
    ip,
    success,
    org_id: orgId || null,
  });

  if (error) {
    console.error("Failed to persist login_attempt — rate limit may be weaker:", error);
  }
}

/**
 * Deletes login attempts older than 24 hours (called by keepalive cron)
 */
export async function cleanupOldAttempts(): Promise<{ deleted: boolean; error?: string }> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("login_attempts")
      .delete()
      .lt("created_at", cutoff);

    if (error) throw error;
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: String(err) };
  }
}

/**
 * Rate limits public member actions (60 requests per IP per minute)
 */
export async function checkPublicTokenRateLimit(
  ip: string,
  token: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `${ip}:${token}`;
  const now = Date.now();
  const windowDurationMs = PUBLIC_API_RATE_LIMIT.WINDOW_SECONDS * 1000;

  const entry = publicTokenAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    publicTokenAttempts.set(key, { count: 1, resetAt: now + windowDurationMs });
    return { allowed: true };
  }

  if (entry.count >= PUBLIC_API_RATE_LIMIT.MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
}
