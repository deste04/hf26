// Profile data, split by section so each one streams in on its own instead of the page waiting for the slowest.
// cache() (per request) lets several sections share one fetch of the same data, e.g. the vouch lists.
import { cache } from "react";
import { isGithubLogin } from "../lib/query";
import {
  contributionCalendar,
  getUser,
  repoActivity,
  userCommitCounts,
  userContributions,
  type Calendar,
  type GhUser,
  type RepoCounts,
} from "./github";
import type { TrustEdge } from "./trust/types";
import { userEdges, type UserTrust } from "./vouch";

export type RepoActivity = RepoCounts & {
  repo: string;
  vouch: "vouched" | "denounced" | null;
};

/** Name and avatar: one cached call, so the page header shows almost at once. */
export const profileUser = cache(async (login: string): Promise<{ user: GhUser | null; error: string | null }> => {
  if (!isGithubLogin(login)) return { user: null, error: null };
  try {
    return { user: await getUser(login), error: null };
  } catch (err) {
    return { user: null, error: (err as Error).message };
  }
});

/** Every VOUCHED.td naming the person. The slowest read on a first visit; shared by the badges and the table. */
export const profileTrust = cache(async (login: string): Promise<UserTrust> => {
  // GitHub answers 422 to a search for a malformed login, so such a handle never reaches it.
  if (!isGithubLogin(login)) return { status: "unavailable", message: "Not a GitHub login." };
  return userEdges(login);
});

/** The contribution calendar for the last year, or null when GitHub has none to give. */
export async function profileCalendar(login: string): Promise<Calendar | null> {
  if (!isGithubLogin(login)) return null;
  try {
    return await contributionCalendar(login);
  } catch {
    return null;
  }
}

/** Years the account has existed, newest first, for the calendar's year switch. */
export function accountYears(user: GhUser | null): number[] {
  const thisYear = new Date().getUTCFullYear();
  const firstYear = user?.created_at ? new Date(user.created_at).getUTCFullYear() : thisYear;
  return Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);
}

export type ProfileActivity = {
  rows: RepoActivity[];
  /** "last year": complete counts (GraphQL, with a token); "recent": a search sample (without one). */
  period: "last year" | "recent";
  trust: UserTrust;
  edges: TrustEdge[];
  error: string | null;
};

/** Activity by project, every vouch list entry included. Its reads run in parallel. */
export const profileActivity = cache(async (login: string): Promise<ProfileActivity> => {
  if (!isGithubLogin(login)) {
    return { rows: [], period: "recent", trust: { status: "unavailable", message: "Not a GitHub login." }, edges: [], error: null };
  }
  let error: string | null = null;
  const [trust, counts] = await Promise.all([profileTrust(login), repoActivity(login).catch(() => null)]);
  // Without a token: count a sample of recent contributions and commits from search instead.
  const [contributions, commits] = counts
    ? [[], {}]
    : await Promise.all([
        userContributions(login).catch((err) => {
          error = (err as Error).message;
          return [];
        }),
        userCommitCounts(login).catch(() => ({}) as Record<string, number>),
      ]);

  const edges: TrustEdge[] = trust.status === "ok" ? trust.edges : [];
  const byRepo = new Map<string, RepoActivity>();
  const row = (repo: string) => {
    let r = byRepo.get(repo.toLowerCase());
    if (!r) {
      r = { repo, commits: 0, prs: 0, issues: 0, reviews: 0, vouch: null };
      byRepo.set(repo.toLowerCase(), r);
    }
    return r;
  };
  if (counts) {
    for (const [repo, n] of Object.entries(counts)) Object.assign(row(repo), n);
  } else {
    for (const c of contributions) {
      const r = row(c.repo);
      if (c.kind === "review") r.reviews++;
      else if (c.kind === "issue") r.issues++;
      else r.prs++;
    }
    for (const [repo, n] of Object.entries(commits)) row(repo).commits = n;
  }
  for (const e of edges) row(e.project).vouch = e.status;
  // Every project with a vouch list entry comes first, even with no activity; then the busiest repos.
  const total = (r: RepoActivity) => r.commits + r.prs + r.issues + r.reviews;
  const rows = [...byRepo.values()].sort((a, b) => Number(!!b.vouch) - Number(!!a.vouch) || total(b) - total(a));
  return { rows, period: counts ? "last year" : "recent", trust, edges, error };
});
