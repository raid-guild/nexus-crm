import { createHmac, timingSafeEqual } from "crypto";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth/types";
import * as z from "zod";

type PortalLaunchClaims = {
  typ?: string;
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  userID?: string | number;
  profileID?: string | number;
  email?: string;
  name?: string;
  handle?: string;
  picture?: string;
  roles?: string[];
  moduleSlug?: string;
  scopes?: string[];
};

const querySchema = z.object({
  token: z.string().min(1),
  next: z.string().optional(),
});

const portalAuthError = (
  status: Parameters<typeof APIError.fromStatus>[0],
  message: string,
) => APIError.fromStatus(status, { message });

const base64UrlDecode = (value: string) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const parseJsonPart = <T>(part: string): T => {
  try {
    return JSON.parse(base64UrlDecode(part).toString("utf8")) as T;
  } catch {
    throw portalAuthError("BAD_REQUEST", "Invalid Portal launch token");
  }
};

const verifyPortalLaunchToken = (token: string): PortalLaunchClaims => {
  const secret = process.env.PORTAL_MODULE_LAUNCH_SECRET;
  const issuer = process.env.PORTAL_LAUNCH_ISSUER;
  const audience = process.env.PORTAL_LAUNCH_AUDIENCE;
  const moduleSlug = process.env.PORTAL_LAUNCH_MODULE_SLUG || audience;

  if (!secret || !issuer || !audience || !moduleSlug) {
    throw portalAuthError("INTERNAL_SERVER_ERROR", "Portal launch auth is not configured");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw portalAuthError("BAD_REQUEST", "Invalid Portal launch token");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJsonPart<{ alg?: string }>(encodedHeader);
  const claims = parseJsonPart<PortalLaunchClaims>(encodedPayload);

  if (header.alg !== "HS256") {
    throw portalAuthError("BAD_REQUEST", "Unsupported Portal launch token algorithm");
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actualSignature = base64UrlDecode(encodedSignature);

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw portalAuthError("UNAUTHORIZED", "Invalid Portal launch token signature");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now) {
    throw portalAuthError("UNAUTHORIZED", "Portal launch token has expired");
  }
  if (claims.nbf && claims.nbf > now) {
    throw portalAuthError("UNAUTHORIZED", "Portal launch token is not active yet");
  }
  if (claims.typ !== "portal_module_launch") {
    throw portalAuthError("BAD_REQUEST", "Invalid Portal launch token type");
  }
  if (claims.iss !== issuer) {
    throw portalAuthError("UNAUTHORIZED", "Invalid Portal launch token issuer");
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    throw portalAuthError("UNAUTHORIZED", "Invalid Portal launch token audience");
  }
  if (claims.moduleSlug !== moduleSlug) {
    throw portalAuthError("UNAUTHORIZED", "Invalid Portal launch module");
  }
  if (!claims.email) {
    throw portalAuthError("BAD_REQUEST", "Portal launch token is missing an email claim");
  }

  return claims;
};

const safeRedirectPath = (path?: string) => {
  const fallback = process.env.PORTAL_LAUNCH_REDIRECT_PATH || "/";
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
};

const portalDisplayName = (claims: PortalLaunchClaims) =>
  claims.name || claims.handle || claims.email?.split("@")[0] || "";

export const portalLaunchAuth = (): BetterAuthPlugin => ({
  id: "portal-launch-auth",
  endpoints: {
    portalLaunchCallback: createAuthEndpoint(
      "/portal/callback",
      {
        method: "GET",
        query: querySchema,
      },
      async (ctx) => {
        const claims = verifyPortalLaunchToken(ctx.query.token);
        const email = claims.email!.toLowerCase();
        const existing = await ctx.context.internalAdapter.findUserByEmail(email);

        const user = existing
          ? await ctx.context.internalAdapter.updateUser(existing.user.id, {
              emailVerified: true,
              name: existing.user.name || portalDisplayName(claims),
              image: existing.user.image || claims.picture,
              avatar: claims.picture,
              userStatus: "ACTIVE",
              lastLoginAt: new Date(),
            })
          : await ctx.context.internalAdapter.createUser({
              email,
              emailVerified: true,
              name: portalDisplayName(claims),
              image: claims.picture,
              avatar: claims.picture,
              role: "user",
              userStatus: "ACTIVE",
              userLanguage: "en",
              username: claims.handle,
              lastLoginAt: new Date(),
            });

        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });

        throw ctx.redirect(safeRedirectPath(ctx.query.next));
      },
    ),
  },
});
