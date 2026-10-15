import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SESSION_REFRESH_THRESHOLD_SECONDS,
} from "@/lib/constants";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "fallback-secret-for-build-purposes-min-32-chars!";
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  let isValidSession = false;
  let decodedPayload: JWTPayload | null = null;
  let shouldRefresh = false;

  if (sessionCookie) {
    try {
      const { payload } = await jwtVerify(sessionCookie, getSecretKey());
      decodedPayload = payload;
      isValidSession = true;

      // 7-day auto refresh check
      if (payload.iat) {
        const ageInSeconds = Math.floor(Date.now() / 1000) - payload.iat;
        if (ageInSeconds > SESSION_REFRESH_THRESHOLD_SECONDS) {
          shouldRefresh = true;
        }
      }
    } catch {
      isValidSession = false;
    }
  }

  // Redirect from login to admin if already authenticated
  if (pathname === "/login" && isValidSession) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Protect admin pages and admin APIs
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminRoute || isAdminApi) {
    if (!isValidSession) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required. Please log in with your PIN.",
            },
          },
          { status: 401 }
        );
      }
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // CSRF check on state-changing API requests (Review Fix #13)
    if (isAdminApi && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      if (origin && host) {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "Cross-site request blocked.",
              },
            },
            { status: 403 }
          );
        }
      }
    }
  }

  const response = NextResponse.next();

  // If session is older than 7 days, refresh with a new 30-day token
  if (shouldRefresh && decodedPayload) {
    try {
      const newToken = await new SignJWT({ ...decodedPayload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
        .sign(getSecretKey());

      response.cookies.set(SESSION_COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DURATION_SECONDS,
      });
    } catch (err) {
      console.warn("Could not auto-refresh session cookie:", err);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/login",
  ],
};
