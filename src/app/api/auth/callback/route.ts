// GET /api/auth/callback?code&state → checks the state, trades the code for a token, reads the user, sets the session.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callbackUrl, createSession, safeNext, signInConfigured } from "@/server/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get("oauth_state")?.value;
  const next = jar.get("oauth_next")?.value;
  jar.delete("oauth_state");
  jar.delete("oauth_next");
  const fail = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, url), 303);

  if (!signInConfigured()) return fail("setup");
  if (url.searchParams.get("error") === "access_denied") return fail("denied");
  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) return fail("failed");

  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl(request),
      }),
    });
    const { access_token: token } = (await res.json()) as { access_token?: string };
    if (!token) return fail("failed");
    const user = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "vouch-explorer" },
    });
    if (!user.ok) return fail("failed");
    const u = (await user.json()) as { login: string; name: string | null; avatar_url: string };
    await createSession({ login: u.login, name: u.name, avatar: u.avatar_url, token });
    return NextResponse.redirect(new URL(next ? safeNext(next) : `/u/${encodeURIComponent(u.login)}`, url), 303);
  } catch {
    return fail("failed");
  }
}
