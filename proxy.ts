import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

function getPublicAppURL(): URL | null {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizePublicRedirect(response: NextResponse): NextResponse {
  const publicURL = getPublicAppURL();
  const location = response.headers.get("location");

  if (!publicURL || !location) return response;

  try {
    const redirectURL = new URL(location, publicURL);
    if (redirectURL.hostname.endsWith(".up.railway.app") && redirectURL.port === "8080") {
      redirectURL.port = "";
      response.headers.set("location", redirectURL.toString());
      return response;
    }

    if (redirectURL.hostname === publicURL.hostname) {
      redirectURL.protocol = publicURL.protocol;
      redirectURL.host = publicURL.host;
      response.headers.set("location", redirectURL.toString());
    }
  } catch {
    return response;
  }

  return response;
}

// Admin-only API paths — cookie presence checked here, role checked server-side
const ADMIN_ONLY_PATHS = [
  "/api/user/activateAdmin",
  "/api/user/deactivateAdmin",
  "/api/user/activate",
  "/api/user/deactivate",
  "/api/user/inviteuser",
  "/api/admin",
];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Inngest webhook — pass through, Inngest handles its own auth via signing key
  if (path.startsWith("/api/inngest")) {
    return NextResponse.next();
  }

  // better-auth API routes — pass through to better-auth handler
  if (path.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Portal signed-launch callback must run before session enforcement.
  if (path === "/portal/callback") {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(req);

  // Admin-only routes — require session cookie (role checked server-side)
  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) {
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Non-API routes — redirect to sign-in if no session cookie
  if (!path.startsWith("/api")) {
    if (!sessionCookie) {
      // Allow auth pages (sign-in, register, pending, inactive)
      const authPaths = ["/sign-in", "/register", "/pending", "/inactive"];
      const isAuthPage = authPaths.some((p) => path.includes(p));
      if (!isAuthPage) {
        const publicURL = getPublicAppURL();
        return NextResponse.redirect(new URL("/sign-in", publicURL ?? req.nextUrl));
      }
    }
  }

  // Non-API routes — delegate to next-intl
  return normalizePublicRedirect(intlMiddleware(req));
}

export const config = {
  matcher: [
    // Admin-only API paths
    "/api/user/activateAdmin/:path*",
    "/api/user/deactivateAdmin/:path*",
    "/api/user/activate/:path*",
    "/api/user/deactivate/:path*",
    "/api/user/inviteuser",
    "/api/admin/:path*",
    // better-auth API
    "/api/auth/:path*",
    // All non-API routes (existing intl matcher)
    "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
  ],
};
