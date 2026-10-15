import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  BCRYPT_SALT_ROUNDS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SESSION_REFRESH_THRESHOLD_SECONDS,
} from "./constants";
import { supabase } from "./supabase";
import type { SessionPayload } from "@/types";

export interface AdminContext {
  adminId: string;
  orgId: string;
  name: string;
  role: "owner" | "co_admin";
  timezone: string;
  sessionVersion: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. Refusing to sign/verify sessions with a fallback."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Hashes a 6-digit PIN with bcrypt
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(pin, salt);
}

/**
 * Compares entered PIN against stored bcrypt hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Creates a signed JWT valid for 30 days
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verifies and decodes a signed JWT session token
 */
export async function verifySessionToken(
  token?: string | null
): Promise<(SessionPayload & JWTPayload) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload & JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Checks if JWT was issued more than 7 days ago
 */
export function shouldRefreshSession(payload: JWTPayload): boolean {
  if (!payload.iat) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return nowInSeconds - payload.iat > SESSION_REFRESH_THRESHOLD_SECONDS;
}

/**
 * Gets the verified session payload from cookies
 */
export async function getServerSession(): Promise<(SessionPayload & JWTPayload) | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/**
 * Attaches the session cookie to the response
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/**
 * Clears the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Enforces admin authentication with session_version database revocation check.
 * Used by all protected /api/admin/* routes.
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const session = await getServerSession();
  if (!session) return null;

  try {
    const { data: admin, error } = await supabase
      .from("admin")
      .select("id, org_id, name, role, timezone, session_version")
      .eq("id", session.sub)
      .single();

    if (error || !admin) {
      // Explicit opt-in only — never auto-bypass in production or plain NODE_ENV=development
      if (
        process.env.ALLOW_DEV_AUTH === "true" &&
        process.env.NODE_ENV !== "production" &&
        session.sub === "00000000-0000-0000-0000-000000000001"
      ) {
        return {
          adminId: session.sub,
          orgId: session.orgId,
          name: session.name,
          role: session.role,
          timezone: session.timezone,
          sessionVersion: session.sessionVersion,
        };
      }
      await clearSessionCookie();
      return null;
    }

    // Revocation check: if session_version does not match, PIN was changed!
    if (admin.session_version !== session.sessionVersion) {
      await clearSessionCookie();
      return null;
    }

    return {
      adminId: admin.id,
      orgId: admin.org_id,
      name: admin.name,
      role: admin.role,
      timezone: admin.timezone,
      sessionVersion: admin.session_version,
    };
  } catch (err) {
    console.error("requireAdmin lookup error:", err);
    return null;
  }
}
