// GitHub auth, pacing and retry, shared by the cached readers in ./github.ts and ./vouch.ts.
// Token order: the signed-in person's (from the session), else the server's (GITHUB_TOKEN or `gh auth token`).
import { Octokit } from "@octokit/rest";
import { execSync } from "node:child_process";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";

/**
 * Per request: the signed-in person's token, and whether the server's own token failed (rate limit, revoked, none).
 * "use cache" clears every AsyncLocalStorage before it runs, but restores Next's work store, so the request is
 * found through that store. The token stays out of the cache key: results are public and shared by everyone.
 */
type Viewer = { token?: string; serverFailed: boolean };
const viewers = new WeakMap<object, Viewer>();
function viewer(): Viewer | undefined {
  const store = workAsyncStorage.getStore();
  if (!store) return undefined;
  let v = viewers.get(store);
  if (!v) viewers.set(store, (v = { serverFailed: false }));
  return v;
}

/** Called once per request, outside any cache, with the session's token (or none to use the server's). */
export function setViewerToken(token: string | undefined) {
  const v = viewer();
  if (v) v.token = token;
}

/** True when this request hit a limit or auth error on the server's token, or the server has no token at all. */
export function serverTokenFailed(): boolean {
  return viewer()?.serverFailed ?? false;
}

/** Rate limits (primary and secondary) and bad credentials: the token, not the request, is the problem. */
function isTokenProblem(err: unknown): boolean {
  const { status, message } = err as { status?: number; message?: string };
  return status === 401 || status === 429 || /rate limit/i.test(message ?? "");
}

let server: Octokit | undefined;
let authed = false;
function serverClient(): Octokit {
  if (server) return server;
  let auth = process.env.GITHUB_TOKEN;
  if (!auth) {
    try {
      auth = execSync("gh auth token", { encoding: "utf8" }).trim();
    } catch {
      /* unauthenticated: low rate limits */
    }
  }
  authed = Boolean(auth);
  server = new Octokit({ auth, userAgent: "vouch-explorer" });
  server.hook.error("request", (err) => {
    if (isTokenProblem(err)) {
      const v = viewer();
      if (v) v.serverFailed = true;
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
    userClients.set(token, c);
    if (userClients.size > 500) userClients.delete(userClients.keys().next().value!);
  }
  return c;
}

export function octokit(): Octokit {
  const token = viewer()?.token;
  return token ? userClient(token) : serverClient();
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
