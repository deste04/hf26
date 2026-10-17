// Trust data read live from GitHub, cached with Next's "use cache" instead of a local index.
//   projectEdges("owner/repo") → the repo's VOUCHED.td, each line attributed to the commit that added it
//   userEdges("login")         → every VOUCHED.td that lists the login (code search needs a token; recent activity
//                                fills in what it misses)
import { cacheLife, cacheTag } from "next/cache";
import { personTag } from "./github";
import { hasToken, octokit, split, withRetry } from "./githubCore";
import type { TrustEdge } from "./trust/types";
import { entryKeys, parseVouchFile, type VouchEntry } from "./vouchParser";

/** Vouch reads only these two locations; other hits are templates or vendored copies of another project's list. */
const PATHS = ["VOUCHED.td", ".github/VOUCHED.td"];
/** Without a token: commits of history read per file. Lines older than this window keep an unknown voucher. */
const MAX_COMMITS = 30;
/** Repos taken from a person's recent activity, and from their own most recently pushed repos. */
const MAX_ACTIVE = 12;
/** Code search pages of 100 read per person (GitHub allows 10 code searches a minute). */
const SEARCH_PAGES = 2;
/** A list counts as a copy of a larger one when this share of its entries is in it… */
const COPY_OVERLAP = 0.9;
/** …and it is at least this long, so two short lists never merge by coincidence. */
const COPY_MIN_ENTRIES = 20;

/** raw.githubusercontent.com does not count against the REST API rate limit. */
async function raw(fullName: string, ref: string, path: string): Promise<string | null> {
  const res = await fetch(`https://raw.githubusercontent.com/${fullName}/${ref}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`raw.githubusercontent.com ${res.status}`);
  return res.text();
}

type Attribution = { voucher: string | null; date: string; sha: string };

/**
 * Who vouched, from the commit that wrote the line. Vouch's bot commits on a maintainer's behalf and names them in
 * its message ("Triggered by … from @jcollie."), so a bot author is replaced by that maintainer. A bot commit that
 * names nobody stays unknown: never guessed.
 */
function voucherOf(author: string | null, message: string): string | null {
  if (author && !author.endsWith("[bot]")) return author;
  return message.match(/\bfrom @([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/)?.[1] ?? null;
}

/** Git blame of the file at HEAD through GraphQL (needs a token): one call, the whole history, line by line. */
async function blame(fullName: string, path: string): Promise<Map<number, Attribution> | null> {
  type Range = { startingLine: number; endingLine: number; commit: { oid: string; committedDate: string; message: string; author: { user: { login: string } | null } | null } };
  type Res = { repository: { object: { blame: { ranges: Range[] } } | null } | null };
  const { owner, repo } = split(fullName);
  try {
    const res = await withRetry(
      () =>
        octokit().graphql<Res>(
          `query($owner: String!, $name: String!, $path: String!) {
            repository(owner: $owner, name: $name) {
              object(expression: "HEAD") {
                ... on Commit { blame(path: $path) { ranges { startingLine endingLine commit { oid committedDate message author { user { login } } } } } }
              }
            }
          }`,
          { owner, name: repo, path },
        ),
      1,
    );
    const ranges = res.repository?.object?.blame.ranges;
    if (!ranges) return null;
    const out = new Map<number, Attribution>();
    for (const r of ranges) {
      const a = { voucher: voucherOf(r.commit.author?.user?.login ?? null, r.commit.message), date: r.commit.committedDate, sha: r.commit.oid };
      for (let line = r.startingLine; line <= r.endingLine; line++) out.set(line, a);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Without a token: walk the file's last MAX_COMMITS commits oldest first and remember the commit that last added or
 * flipped each line. Lines already in the oldest commit stay unknown.
 */
async function walkHistory(fullName: string, path: string): Promise<Map<string, Attribution>> {
  const out = new Map<string, Attribution>();
  let commits: { sha: string; voucher: string | null; date: string }[];
  try {
    // One try: a rate-limited history only costs the voucher names, not the page.
    const { data } = await withRetry(() => octokit().repos.listCommits({ ...split(fullName), path, per_page: MAX_COMMITS }), 1);
    commits = data
      .map((c) => ({
        sha: c.sha,
        voucher: voucherOf(c.author?.login ?? null, c.commit.message),
        date: c.commit.committer?.date ?? c.commit.author?.date ?? "",
      }))
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
      if (!before || before.status !== e.status) out.set(key, { voucher: commits[i].voucher, date: commits[i].date, sha: commits[i].sha });
    }
    prev = cur;
  }
  return out;
}

/** Attribution per entry key: blame when a token is set, else the recent-history walk. */
async function attribute(fullName: string, path: string, entries: VouchEntry[]): Promise<Map<string, Attribution>> {
  const lines = hasToken() ? await blame(fullName, path) : null;
  if (!lines) return walkHistory(fullName, path);
  const out = new Map<string, Attribution>();
  for (const e of entries) {
    const a = lines.get(e.line);
    if (a) out.set(`${e.platform}:${e.login.toLowerCase()}`, a);
  }
  return out;
}

export type ProjectTrust = { project: string; path: string; edges: TrustEdge[] };

type VouchFile = { path: string; text: string };

/** The repo's VOUCHED.td text, from the given path or the first of PATHS that exists. */
async function vouchFile(fullName: string, path?: string): Promise<VouchFile | null> {
  "use cache";
  cacheLife("hours");
  for (const p of path ? [path] : PATHS) {
    const text = await raw(fullName, "HEAD", p);
    if (text !== null) return { path: p, text };
  }
  return null;
}

/** The project's current VOUCHED.td with voucher attribution, or null when the repo has none. */
export async function projectEdges(fullName: string): Promise<ProjectTrust | null> {
  "use cache";
  cacheLife("hours");
  const file = await vouchFile(fullName);
  if (!file) return null;
  const entries = parseVouchFile(file.text).filter((e) => e.platform === "github");
  const who = await attribute(fullName, file.path, entries);
  const edges = entries.map<TrustEdge>((e) => {
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
  return { project: fullName, path: file.path, edges };
}

type Hit = { repo: string; path?: string };

/** VOUCHED.td files mentioning the login, via GitHub code search (which refuses anonymous calls). */
async function reposMentioning(login: string): Promise<Hit[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(personTag(login));
  const hits = new Map<string, Hit>();
  for (let page = 1; page <= SEARCH_PAGES; page++) {
    let items;
    try {
      ({ data: { items } } = await withRetry(() => octokit().search.code({ q: `${login} filename:VOUCHED.td`, per_page: 100, page }), 1));
    } catch (err) {
      if (page === 1) throw err;
      break; // keep what the first page found
    }
    for (const i of items) if (PATHS.includes(i.path)) hits.set(i.repository.full_name.toLowerCase(), { repo: i.repository.full_name, path: i.path });
    if (items.length < 100) break;
  }
  return [...hits.values()];
}

/**
 * Repos the login was active in lately (public events, last 90 days) plus their own most recently pushed repos.
 * Code search lags on new or small repos and misses them for weeks; these two lists do not, and people are usually
 * vouched where they contribute, or in the projects they own. Either list failing just leaves it out.
 */
async function reposActiveIn(login: string): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(personTag(login));
  const [events, owned] = await Promise.allSettled([
    withRetry(() => octokit().activity.listPublicEventsForUser({ username: login, per_page: 100 }), 1),
    withRetry(() => octokit().repos.listForUser({ username: login, sort: "pushed", per_page: MAX_ACTIVE }), 1),
  ]);
  const fromEvents = events.status === "fulfilled" ? [...new Set(events.value.data.map((e) => e.repo.name))].slice(0, MAX_ACTIVE) : [];
  const fromOwned = owned.status === "fulfilled" ? owned.value.data.map((r) => r.full_name) : [];
  return [...new Set([...fromEvents, ...fromOwned])];
}

/** Runs fn over items with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

type Listing = { repo: string; entry: VouchEntry; keys: Set<string>; copies: string[] };

/**
 * Finds which lists were copied from another one. Forks and re-uploads of a project (dozens of ghostty clones, say)
 * carry its VOUCHED.td along, often an older snapshot. Every list is still shown; this only orders them, originals
 * first.
 * Largest list first, so a copy always meets its original before itself.
 */
function groupCopies(listings: Listing[]): Listing[] {
  const originals: Listing[] = [];
  for (const l of [...listings].sort((a, b) => b.keys.size - a.keys.size || a.repo.length - b.repo.length)) {
    const original =
      l.keys.size >= COPY_MIN_ENTRIES &&
      originals.find((o) => {
        let shared = 0;
        for (const k of l.keys) if (o.keys.has(k)) shared++;
        return shared / l.keys.size >= COPY_OVERLAP;
      });
    if (original) original.copies.push(l.repo);
    else originals.push(l);
  }
  return originals;
}

export type UserTrust = { status: "ok"; edges: TrustEdge[] } | { status: "needs_token" } | { status: "unavailable"; message: string };

let warned = false;

/** Every VOUCHED.td entry for the login: original lists first, then the copies. */
export async function userEdges(login: string): Promise<UserTrust> {
  if (!hasToken()) {
    // A setup problem for whoever runs the app, not something visitors can act on: log it, keep the UI quiet.
    if (!warned) console.warn("GITHUB_TOKEN is not set: person search across VOUCHED.td files is off.");
    warned = true;
    return { status: "needs_token" };
  }
  const [searched, active] = await Promise.allSettled([reposMentioning(login), reposActiveIn(login)]);
  if (searched.status === "rejected") return { status: "unavailable", message: (searched.reason as Error).message };
  const hits = new Map<string, Hit>();
  for (const r of active.status === "fulfilled" ? active.value : []) hits.set(r.toLowerCase(), { repo: r });
  for (const h of searched.value) hits.set(h.repo.toLowerCase(), h);

  // Text only first (raw.githubusercontent.com, outside the API limit): most hits mention the login in a comment.
  const me = login.toLowerCase();
  const files = await mapLimit([...hits.values()], 8, (h) => vouchFile(h.repo, h.path).catch(() => null));
  const listings: Listing[] = [];
  [...hits.values()].forEach((h, i) => {
    const entries = files[i] ? parseVouchFile(files[i].text).filter((e) => e.platform === "github") : [];
    const entry = entries.find((e) => e.login.toLowerCase() === me);
    if (entry) listings.push({ repo: h.repo, entry, keys: new Set(entries.map((e) => e.login.toLowerCase())), copies: [] });
  });

  // Originals first (the lists projects actually wrote), then every copy; each one attributed by blame.
  const originals = groupCopies(listings).sort((a, b) => b.copies.length - a.copies.length || a.repo.localeCompare(b.repo));
  const ordered = [...originals, ...originals.flatMap((o) => listings.filter((l) => o.copies.includes(l.repo)).sort((a, b) => a.repo.localeCompare(b.repo)))];
  const edges = await mapLimit(ordered, 6, async (l): Promise<TrustEdge> => {
    const full = await projectEdges(l.repo).catch(() => null);
    return (
      full?.edges.find((e) => e.login.toLowerCase() === me) ?? {
        project: l.repo,
        login: l.entry.login,
        status: l.entry.status,
        note: l.entry.note,
        voucher: null,
        occurred_at: null,
        commit_sha: null,
      }
    );
  });
  return { status: "ok", edges };
}
