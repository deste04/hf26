"use server";
import { isGithubLogin } from "../../lib/query";
import {
  contributionCalendar,
  getUser,
  repoActivity,
  userCommitCounts,
  userContributions,
  type Calendar,
  type Contribution,
  type GhUser,
  type RepoCounts,
} from "../github";
import type { TrustEdge } from "../trust/types";
import { userEdges, type UserTrust } from "../vouch";

export type RepoActivity = RepoCounts & {
  repo: string;
  vouch: "vouched" | "denounced" | null;
};

export async function getProfileData(login: string) {
  let user: GhUser | null = null;
  let contributions: Contribution[] = [];
  let commits: Record<string, number> = {};
  let counts: Record<string, RepoCounts> | null = null;
  let githubError: string | null = null;
  let calendar: Calendar | null = null;
  let trust: UserTrust = { status: "unavailable", message: "Not a GitHub login." };
  // GitHub answers 422 to a search for a malformed login, so such a handle never reaches it.
  if (isGithubLogin(login)) {
    trust = await userEdges(login);
    try {
      user = await getUser(login);
    } catch (err) {
      githubError = (err as Error).message;
    }
    try {
      contributions = await userContributions(login);
    } catch (err) {
      githubError = (err as Error).message;
    }
    try {
      counts = await repoActivity(login);
    } catch {
      /* falls back to counting the sampled contributions below */
    }
    if (!counts) {
      try {
        commits = await userCommitCounts(login);
      } catch {
        /* commit counts are extra: the table still shows PRs, issues and reviews */
      }
    }
    try {
      calendar = await contributionCalendar(login);
    } catch {
      /* the profile just skips the calendar */
    }
  }
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
    // Complete per-repo counts for the last year (GraphQL).
    for (const [repo, n] of Object.entries(counts)) Object.assign(row(repo), n);
  } else {
    // Without a token: count a sample of recent contributions and commits from search.
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
  const activity = [...byRepo.values()].sort((a, b) => Number(!!b.vouch) - Number(!!a.vouch) || total(b) - total(a));
  // Years the account has existed, newest first, for the calendar's year switch.
  const thisYear = new Date().getUTCFullYear();
  const firstYear = user?.created_at ? new Date(user.created_at).getUTCFullYear() : thisYear;
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);
  const activityPeriod = counts ? "last year" : "recent";
  return { login: user?.login ?? login, user, edges, trustStatus: trust.status, activity, activityPeriod, calendar, years, githubError };
}

/** One year of the contribution calendar, or the last year when `year` is null. */
export async function getContributionCalendar(login: string, year: number | null) {
  if (!isGithubLogin(login)) return null;
  try {
    return await contributionCalendar(login, year ?? undefined);
  } catch {
    return null;
  }
}
