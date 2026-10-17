// GitHub auth, pacing and retry, shared by the cached readers in ./github.ts and ./vouch.ts.
import { Octokit } from "@octokit/rest";
import { execSync } from "node:child_process";

let client: Octokit | undefined;
let authed = false;
export function octokit(): Octokit {
  if (client) return client;
  let auth = process.env.GITHUB_TOKEN;
  if (!auth) {
    try {
      auth = execSync("gh auth token", { encoding: "utf8" }).trim();
    } catch {
      /* unauthenticated: low rate limits */
    }
  }
  authed = Boolean(auth);
  client = new Octokit({ auth, userAgent: "vouch-explorer" });
  return client;
}

/** GraphQL rejects unauthenticated calls with 403, which withRetry would mistake for a rate limit. */
export function hasToken(): boolean {
  octokit();
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
