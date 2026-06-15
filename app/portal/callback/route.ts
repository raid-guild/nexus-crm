import { NextRequest, NextResponse } from "next/server";

export const GET = (request: NextRequest) => {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || request.nextUrl.origin;
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, origin);
  url.pathname = "/api/auth/portal/callback";
  return NextResponse.redirect(url);
};
