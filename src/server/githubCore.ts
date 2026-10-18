// GitHub auth, pacing and retry, shared by the cached readers in ./github.ts and ./vouch.ts.
// Token order: the signed-in person's (from the session), else the server's (GITHUB_TOKEN).
// Everything read here lands in the shared cache, so it must be public: the readers also drop anything private a
// token might see (private code search hits, private events, isPrivate contributions).
import { Octokit } from "@octokit/rest";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";

/**
 * Per request: the signed-in person's token, whether the server's own token failed (rate limit, revoked, none),
 * and whether it hit a rate limit (after the person's, when someone is signed in).
 * "use cache" clears every AsyncLocalStorage before it runs, but restores Next's work store, so the request is
 * found through that store. The token stays out of the cache key: results are public and shared by everyone.
 */
type Viewer = { token?: string; login?: string; serverFailed: boolean; limited: boolean };
const viewers = new WeakMap<object, Viewer>();
function viewer(): Viewer | undefined {
  const store = workAsyncStorage.getStore();
  if (!store) return undefined;
  let v = viewers.get(store);
  if (!v) viewers.set(store, (v = { serverFailed: false, limited: false }));
  return v;
}

/** Called once per request, outside any cache, with the session's token and login (or none to use the server's). */
export function setViewerToken(token: string | undefined, login?: string) {
  const v = viewer();
  if (v) Object.assign(v, { token, login });
}

/** True when nobody is signed in and this request hit a limit or auth error on the server's token, or it has none. */
export function serverTokenFailed(): boolean {
  const v = viewer();
  return Boolean(v && !v.token && v.serverFailed);
}

/** True when a GitHub read in this request failed on the server's rate limit, the last token tried. */
export function rateLimited(): boolean {
  return Boolean(viewer()?.limited);
}

/** Rate limits, primary and secondary. */
function isLimit(err: unknown): boolean {
  const { status, message } = err as { status?: number; message?: string };
  return status === 429 || /rate limit/i.test(message ?? "");
}

/** Rate limits and bad credentials: the token, not the request, is the problem. */
function isTokenProblem(err: unknown): boolean {
  return (err as { status?: number }).status === 401 || isLimit(err);
}

let server: Octokit | undefined;
let authed = false;
function serverClient(): Octokit {
  if (server) return server;
  // No fallback to the GitHub CLI's token: it usually has the repo scope, and private data must not reach the cache.
  const auth = process.env.GITHUB_TOKEN || undefined;
  authed = Boolean(auth);
  server = new Octokit({ auth, userAgent: "vouch-explorer" });
  server.hook.error("request", (err) => {
    if (isTokenProblem(err)) {
      const v = viewer();
      if (v) Object.assign(v, { serverFailed: true, limited: v.limited || isLimit(err) });
    }
    throw err;
  });
  return server;
}

/** One client per signed-in token, reused across requests; a few hundred at most, then the oldest go. */
const userClients = new Map<string, Octokit>();
function userClient(token: string): Octokit {
  let c = userClients.get(token);
  if (!c) {
    c = new Octokit({ auth: token, userAgent: "vouch-explorer" });
    // Their limits are tighter than they look (code search: 10 a minute): when theirs runs out, or the token was
    // revoked, the same read goes through the server's token instead of failing the page.
    c.hook.wrap("request", async (request, options) => {
      try {
        return await request(options);
      } catch (err) {
        if (!isTokenProblem(err)) throw err;
        const headers = { ...options.headers };
        delete headers.authorization;
        return serverClient().request({ ...options, headers });
      }
    });
    userClients.set(token, c);
    if (userClients.size > 500) userClients.delete(userClients.keys().next().value!);
  }
  return c;
}

/**
 * The client for this request. `subject` is the login being read: GitHub may count a person's private
 * contributions when they read their own, so those reads use the server's token instead of theirs.
 */
export function octokit(subject?: string): Octokit {
  const v = viewer();
  if (!v?.token || (subject && v.login?.toLowerCase() === subject.toLowerCase())) return serverClient();
  return userClient(v.token);
}

/** GraphQL rejects unauthenticated calls with 403, which withRetry would mistake for a rate limit. */
export function hasToken(): boolean {
  const v = viewer();
  if (v?.token) return true;
  serverClient();
  if (!authed && v) v.serverFailed = true;
  return authed;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const split = (fullName: string) => {
  const [owner, repo] = fullName.split("/");
  return { owner, repo };
};

/** Retry on secondary rate limits (403/429) with backoff. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (i >= tries - 1 || (status !== 403 && status !== 429)) throw err;
      const wait = 15_000 * (i + 1);
      console.warn(`  rate limited (${status}), waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}
