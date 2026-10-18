// GET /api/auth/login?next=/path → GitHub's OAuth consent page. The state cookie ties the callback to this browser.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { callbackUrl, safeNext, signInConfigured } from "@/server/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!signInConfigured()) return NextResponse.redirect(new URL("/login?error=setup", url), 303);
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  const temp = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("oauth_state", state, temp);
  // No next: the callback sends them to their own profile.
  const next = url.searchParams.get("next");
  if (next) jar.set("oauth_next", safeNext(next), temp);
  // No scopes: public reads (and their own 5,000 an hour) need none.
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", callbackUrl(request));
  authorize.searchParams.set("state", state);
  return NextResponse.redirect(authorize, 303);
}
