import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SESSION_REFRESH_THRESHOLD_SECONDS,
} from "@/lib/constants";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET missing or too short");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  let isValidSession = false;
  let decodedPayload: JWTPayload | null = null;
  let shouldRefresh = false;
  let secretOk = true;

  let secretKey: Uint8Array | null = null;
  try {
    secretKey = getSecretKey();
  } catch {
    secretOk = false;
  }

  if (sessionCookie && secretOk && secretKey) {
    try {
      const { payload } = await jwtVerify(sessionCookie, secretKey);
      decodedPayload = payload;
      isValidSession = true;

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

  if (pathname === "/login" && isValidSession) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminRoute || isAdminApi) {
    if (!secretOk) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "SERVER_ERROR",
              message: "Server misconfigured: SESSION_SECRET is required.",
            },
          },
          { status: 500 }
        );
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

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

    // CSRF: require Origin (or Sec-Fetch-Site) on state-changing admin APIs
    if (isAdminApi && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      const secFetchSite = req.headers.get("sec-fetch-site");

      if (origin && host) {
        try {
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
        } catch {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "FORBIDDEN",
                message: "Invalid Origin header.",
              },
            },
            { status: 403 }
          );
        }
      } else if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site" && secFetchSite !== "none") {
        // none = navigations / some same-origin cases; block clear cross-site
        if (secFetchSite === "cross-site") {
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
      // Same-origin fetch from browsers usually sends Origin; allow missing Origin for
      // same-origin server tools that send Sec-Fetch-Site: same-origin or omit both.
    }
  }

  const response = NextResponse.next();

  if (shouldRefresh && decodedPayload && secretKey) {
    try {
      const newToken = await new SignJWT({ ...decodedPayload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
        .sign(secretKey);

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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/login"],
};
