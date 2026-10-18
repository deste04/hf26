// GitHub readers for the profile page, cached with Next's "use cache" (no local database).
// Auth, retry and the uncached helpers live in ./githubCore.ts.
// Every call here runs while a page waits, so none of them retries on rate limits: a stale cached value is
// served while it revalidates, and a page without one shows that GitHub is unavailable.
import { cacheLife, cacheTag } from "next/cache";
import { hasToken, octokit, withRetry } from "./githubCore";

/** Tag on everything a profile's activity is built from, so Regenerate can re-read it from GitHub. */
export const personTag = (login: string) => `person:${login.toLowerCase()}`;

export type GhUser = {
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  html_url: string;
  created_at: string;
};

export async function getUser(login: string): Promise<GhUser | null> {
  "use cache";
  cacheLife("days");
  try {
    const { data } = await withRetry(() => octokit().users.getByUsername({ username: login }), 1);
    return {
      login: data.login,
      avatar_url: data.avatar_url,
      name: data.name,
      bio: data.bio,
      html_url: data.html_url,
      created_at: data.created_at,
    };
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export type Contribution = {
  kind: "pr" | "review" | "issue";
  title: string;
  repo: string; // owner/repo
  state: "open" | "merged" | "closed";
  url: string;
  created_at: string;
};

/** Recent public contributions, newest first within each kind: up to 50 authored PRs, 30 reviews and 50 issues. */
export async function userContributions(login: string): Promise<Contribution[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(personTag(login));
  const search = async (q: string, kind: Contribution["kind"], n: number) => {
    // Search allows 10 requests a minute without a token.
    const { data } = await withRetry(
      () => octokit().search.issuesAndPullRequests({ q, sort: "updated", order: "desc", per_page: n }),
      1,
    );
    return data.items.map<Contribution>((i) => ({
      kind,
      title: i.title,
      repo: i.repository_url.replace("https://api.github.com/repos/", ""),
      state: i.pull_request?.merged_at ? "merged" : i.state === "open" ? "open" : "closed",
      url: i.html_url,
      created_at: i.created_at,
    }));
  };
  const [prs, reviews, issues] = await Promise.all([
    search(`author:${login} type:pr is:public`, "pr", 50),
    search(`reviewed-by:${login} -author:${login} type:pr is:public`, "review", 30),
    search(`author:${login} type:issue is:public`, "issue", 50),
  ]);
  return [...prs, ...reviews, ...issues];
}

/**
 * Commits per repo among the person's 100 most recent public commits. Commit search sees repos the issue search
 * misses (work pushed straight to a branch, or repos too new for that index).
 */
export async function userCommitCounts(login: string): Promise<Record<string, number>> {
  "use cache";
  cacheLife("hours");
  cacheTag(personTag(login));
  const { data } = await withRetry(
    () => octokit(login).search.commits({ q: `author:${login} is:public`, sort: "author-date", order: "desc", per_page: 100 }),
    1,
  );
  const counts: Record<string, number> = {};
  for (const c of data.items) counts[c.repository.full_name] = (counts[c.repository.full_name] ?? 0) + 1;
  return counts;
}

export type RepoCounts = { commits: number; prs: number; issues: number; reviews: number };

/**
 * Every repo the person ever contributed to, with complete counts per kind: the same data as the GitHub profile's
 * contribution breakdown, summed over every year since the account was created. GitHub serves at most one year per
 * query, so each year is its own cached read (past years keep for days). GraphQL only (needs a token); null without one.
 */
export async function repoActivity(login: string): Promise<Record<string, RepoCounts> | null> {
  if (!hasToken()) return null;
  const user = await getUser(login);
  if (!user) return null;
  const thisYear = new Date().getUTCFullYear();
  const years = Array.from({ length: thisYear - new Date(user.created_at).getUTCFullYear() + 1 }, (_, i) => thisYear - i);
  const out: Record<string, RepoCounts> = {};
  // A few years at a time: GraphQL has a secondary limit on concurrent requests.
  for (let i = 0; i < years.length; i += 4) {
    const batch = await Promise.all(years.slice(i, i + 4).map((y) => repoActivityYear(login, y, y < thisYear)));
    for (const year of batch)
      for (const [repo, n] of Object.entries(year ?? {})) {
        const r = (out[repo] ??= { commits: 0, prs: 0, issues: 0, reviews: 0 });
        r.commits += n.commits;
        r.prs += n.prs;
        r.issues += n.issues;
        r.reviews += n.reviews;
      }
  }
  return out;
}

async function repoActivityYear(login: string, year: number, past: boolean): Promise<Record<string, RepoCounts> | null> {
  "use cache";
  if (past) cacheLife("days");
  else cacheLife("hours");
  cacheTag(personTag(login));
  type ByRepo = { repository: { nameWithOwner: string; isPrivate: boolean }; contributions: { totalCount: number } }[];
  type Res = {
    user: {
      contributionsCollection: {
        commitContributionsByRepository: ByRepo;
        pullRequestContributionsByRepository: ByRepo;
        issueContributionsByRepository: ByRepo;
        pullRequestReviewContributionsByRepository: ByRepo;
      };
    } | null;
  };
  const res = await withRetry(
    () =>
      octokit(login).graphql<Res>(
        `query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } contributions { totalCount } }
              pullRequestContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } contributions { totalCount } }
              issueContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } contributions { totalCount } }
              pullRequestReviewContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } contributions { totalCount } }
            }
          }
        }`,
        { login, from: `${year}-01-01T00:00:00Z`, to: past ? `${year}-12-31T23:59:59Z` : new Date().toISOString() },
      ),
    1,
  );
  if (!res.user) return null;
  const c = res.user.contributionsCollection;
  const out: Record<string, RepoCounts> = {};
  const add = (list: ByRepo, field: keyof RepoCounts) => {
    // Private repos the token can see stay out: this result is cached for everyone.
    for (const r of list) if (!r.repository.isPrivate) (out[r.repository.nameWithOwner] ??= { commits: 0, prs: 0, issues: 0, reviews: 0 })[field] += r.contributions.totalCount;
  };
  add(c.commitContributionsByRepository, "commits");
  add(c.pullRequestContributionsByRepository, "prs");
  add(c.issueContributionsByRepository, "issues");
  add(c.pullRequestReviewContributionsByRepository, "reviews");
  return out;
}

export type CalendarDay = { date: string; count: number };
export type Calendar = { days: CalendarDay[]; period: string; unit: { one: string; other: string } };

const CONTRIBUTIONS = { one: "contribution", other: "contributions" };

/**
 * Daily contribution counts for one calendar year, or the last year when `year` is omitted.
 * With a token: GraphQL, as on the GitHub profile calendar.
 * Without one (GraphQL rejects anonymous calls): the same calendar from GitHub's public contributions page.
 * Returns null for unknown users.
 */
export function contributionCalendar(login: string, year?: number) {
  // Past years no longer change, so they keep for days; the current window refreshes every few hours.
  const past = !!year && year < new Date().getUTCFullYear();
  return hasToken() ? graphqlCalendar(login, year, past) : htmlCalendar(login, year, past);
}

async function graphqlCalendar(login: string, year: number | undefined, past: boolean): Promise<Calendar | null> {
  "use cache";
  if (past) cacheLife("days");
  else cacheLife("hours");
  type Res = {
    user: {
      contributionsCollection: {
        contributionCalendar: { weeks: { contributionDays: { date: string; contributionCount: number }[] }[] };
      };
    } | null;
  };
  const res = await withRetry(
    () =>
      octokit(login).graphql<Res>(
        `query($login: String!, $from: DateTime, $to: DateTime) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar { weeks { contributionDays { date contributionCount } } }
            }
          }
        }`,
        year ? { login, from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` } : { login },
      ),
    1,
  );
  if (!res.user) return null;
  const days = res.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
  );
  return { days: inYear(days, year), period: year ? String(year) : "the last year", unit: CONTRIBUTIONS };
}

async function htmlCalendar(login: string, year: number | undefined, past: boolean): Promise<Calendar | null> {
  "use cache";
  if (past) cacheLife("days");
  else cacheLife("hours");
  const range = year ? `?from=${year}-01-01&to=${year}-12-31` : "";
  const res = await fetch(`https://github.com/users/${encodeURIComponent(login)}/contributions${range}`, {
    headers: { "User-Agent": "vouch-explorer" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub contributions page: ${res.status}`);
  const html = await res.text();
  // Each day is a <td data-date id> cell; its count lives in the <tool-tip for=id> label.
  const dateById = new Map<string, string>();
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const date = m[0].match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    if (date && id) dateById.set(id, date);
  }
  const countByDate = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const date = dateById.get(m[1]);
    const n = m[2].match(/^([\d,]+) contribution/)?.[1];
    if (date) countByDate.set(date, n ? Number(n.replace(/,/g, "")) : 0);
  }
  const days = [...dateById.values()].sort().map((date) => ({ date, count: countByDate.get(date) ?? 0 }));
  if (days.length === 0) throw new Error("GitHub contributions page: no days found");
  return { days: inYear(days, year), period: year ? String(year) : "the last year", unit: CONTRIBUTIONS };
}

/** Both sources pad to whole weeks; a calendar year should start on Jan 1 and end on Dec 31. */
function inYear(days: CalendarDay[], year?: number) {
  return year ? days.filter((d) => d.date.startsWith(`${year}-`)) : days;
}
