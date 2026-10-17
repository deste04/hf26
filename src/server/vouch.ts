// Trust data read live from GitHub, cached with Next's "use cache" instead of a local index.
//   projectEdges("owner/repo") → the repo's VOUCHED.td, each line attributed to the commit that added it
//   userEdges("login")         → GitHub code search for VOUCHED.td files naming the login (needs a token)
import { cacheLife } from "next/cache";
import { hasToken, octokit, split, withRetry } from "./githubCore";
import type { TrustEdge } from "./trust/types";
import { entryKeys, parseVouchFile, type VouchEntry } from "./vouchParser";

/** Vouch reads only these two locations; other hits are templates or vendored copies of another project's list. */
const PATHS = ["VOUCHED.td", ".github/VOUCHED.td"];
/** Commits of history read per file. Lines older than this window keep an unknown voucher. */
const MAX_COMMITS = 30;
/** Projects read per person search. */
const MAX_PROJECTS = 12;

/** raw.githubusercontent.com does not count against the REST API rate limit. */
async function raw(fullName: string, ref: string, path: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${fullName}/${ref}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`raw.githubusercontent.com ${res.status}`);
  return res.text();
}

type Attribution = { voucher: string | null; date: string; sha: string };

/**
 * Who set each entry to its current status: walk the file's commits oldest first and remember the commit that last
 * added or flipped each line. With history cut at MAX_COMMITS, lines already in the oldest commit stay unknown.
 */
async function attribute(fullName: string, path: string): Promise<Map<string, Attribution>> {
  const out = new Map<string, Attribution>();
  let commits: { sha: string; author: string | null; date: string }[];
  try {
    // One try: a rate-limited history only costs the voucher names, not the page.
    const { data } = await withRetry(() => octokit().repos.listCommits({ ...split(fullName), path, per_page: MAX_COMMITS }), 1);
    commits = data
      .map((c) => ({ sha: c.sha, author: c.author?.login ?? null, date: c.commit.committer?.date ?? c.commit.author?.date ?? "" }))
      .reverse();
  } catch {
    return out;
  }
  const texts = await Promise.all(commits.map((c) => raw(fullName, c.sha, path).catch(() => null)));
  let prev = new Map<string, VouchEntry>();
  let start = 0;
  if (commits.length === MAX_COMMITS) {
    prev = entryKeys(texts[0] ?? "");
    start = 1;
  }
  for (let i = start; i < commits.length; i++) {
    const cur = entryKeys(texts[i] ?? "");
    for (const [key, e] of cur) {
      const before = prev.get(key);
      if (!before || before.status !== e.status) out.set(key, { voucher: commits[i].author, date: commits[i].date, sha: commits[i].sha });
    }
    prev = cur;
  }
  return out;
}

export type ProjectTrust = { project: string; path: string; edges: TrustEdge[] };

/** The project's current VOUCHED.td with voucher attribution, or null when the repo has none. */
export async function projectEdges(fullName: string): Promise<ProjectTrust | null> {
  "use cache";
  cacheLife("hours");
  for (const path of PATHS) {
    const text = await raw(fullName, "HEAD", path);
    if (text === null) continue;
    const who = await attribute(fullName, path);
    const edges = parseVouchFile(text)
      .filter((e) => e.platform === "github")
      .map<TrustEdge>((e) => {
        const a = who.get(`${e.platform}:${e.login.toLowerCase()}`);
        return {
          project: fullName,
          login: e.login,
          status: e.status,
          note: e.note,
          voucher: a?.voucher ?? null,
          occurred_at: a?.date ?? null,
          commit_sha: a?.sha ?? null,
        };
      });
    return { project: fullName, path, edges };
  }
  return null;
}

/** Repos whose VOUCHED.td mentions the login, via GitHub code search (which refuses anonymous calls). */
async function reposMentioning(login: string): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  const { data } = await withRetry(() => octokit().search.code({ q: `${login} filename:VOUCHED.td`, per_page: 50 }), 1);
  const repos = new Set<string>();
  for (const item of data.items) if (PATHS.includes(item.path)) repos.add(item.repository.full_name);
  return [...repos].slice(0, MAX_PROJECTS);
}

export type UserTrust = { status: "ok"; edges: TrustEdge[] } | { status: "needs_token" } | { status: "unavailable"; message: string };

/** Every indexed-by-GitHub VOUCHED.td entry for the login. Code search needs GITHUB_TOKEN. */
let warned = false;

export async function userEdges(login: string): Promise<UserTrust> {
  if (!hasToken()) {
    // A setup problem for whoever runs the app, not something visitors can act on: log it, keep the UI quiet.
    if (!warned) console.warn("GITHUB_TOKEN is not set: person search across VOUCHED.td files is off.");
    warned = true;
    return { status: "needs_token" };
  }
  let repos: string[];
  try {
    repos = await reposMentioning(login);
  } catch (err) {
    return { status: "unavailable", message: (err as Error).message };
  }
  const lists = await Promise.all(repos.map((r) => projectEdges(r).catch(() => null)));
  const edges = lists.flatMap((l) => l?.edges.filter((e) => e.login.toLowerCase() === login.toLowerCase()) ?? []);
  return { status: "ok", edges };
}
