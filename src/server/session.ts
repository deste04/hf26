// Sign in with GitHub: the signed-in person and their OAuth token, kept in an encrypted httpOnly cookie (no
// database). The token reads GitHub on their behalf (see ./githubCore.ts) and never leaves the server.
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { serverTokenFailed, setViewerToken } from "./githubCore";

/** What the browser may see of a session. */
export type SessionUser = { login: string; name: string | null; avatar: string };
export type Session = SessionUser & { token: string };

const COOKIE = "session";
const MAX_AGE = 30 * 24 * 60 * 60;

/** Sign-in needs an OAuth app and a secret for the cookie; without them the button explains it is not set up. */
export function signInConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && (process.env.SESSION_SECRET?.length ?? 0) >= 32);
}

/** A 256-bit key from SESSION_SECRET, for A256GCM. */
const key = () => createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();

export async function createSession(session: Session) {
  const jwt = await new EncryptJWT(session)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .encrypt(key());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt || !signInConfigured()) return null;
  try {
    const { payload } = await jwtDecrypt(jwt, key());
    return { login: String(payload.login), name: (payload.name as string | null) ?? null, avatar: String(payload.avatar), token: String(payload.token) };
  } catch {
    return null; // expired, or written with another secret
  }
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * The OAuth callback, which must match the one registered on GitHub exactly. APP_URL (e.g. http://127.0.0.1:3000
 * or the public site) overrides the address the request came in on.
 */
export function callbackUrl(request: Request): string {
  return new URL("/api/auth/callback", process.env.APP_URL || request.url).toString();
}

/** Where to land after signing in: only a path on this site, never another origin. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/** Reads GitHub as the signed-in person for the rest of this request, or as the server when nobody is. */
export async function readAsViewer(): Promise<Session | null> {
  const session = await getSession();
  setViewerToken(session?.token);
  return session;
}

/** Nobody signed in and the server's token no longer works: send them to sign in, then back to `next`. */
export function loginIfServerTokenFailed(next: string) {
  if (serverTokenFailed()) redirect(`/login?error=limit&next=${encodeURIComponent(safeNext(next))}`);
}
