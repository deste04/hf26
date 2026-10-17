"use server";
import { isGithubLogin } from "../../lib/query";
import { contributionCalendar, getUser, userContributions, type Calendar, type Contribution, type GhUser } from "../github";
import type { TrustEdge } from "../trust/types";
import { userEdges, type UserTrust } from "../vouch";

export type RepoActivity = {
  repo: string;
  merged: number;
  closed: number;
  open: number;
  reviews: number;
  issues: number;
  vouch: "vouched" | "denounced" | null;
  urls: string[];
};

export async function getProfileData(login: string) {
  let user: GhUser | null = null;
  let contributions: Contribution[] = [];
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
      r = { repo, merged: 0, closed: 0, open: 0, reviews: 0, issues: 0, vouch: null, urls: [] };
      byRepo.set(repo.toLowerCase(), r);
    }
    return r;
  };
  for (const c of contributions) {
    const r = row(c.repo);
    if (c.kind === "review") r.reviews++;
    else if (c.kind === "issue") r.issues++;
    else r[c.state]++;
    r.urls.push(c.url);
  }
  for (const e of edges) row(e.project).vouch = e.status;
  const activity = [...byRepo.values()].sort(
    (a, b) => b.merged + b.closed + b.open + b.reviews + b.issues - (a.merged + a.closed + a.open + a.reviews + a.issues),
  );
  // Years the account has existed, newest first, for the calendar's year switch.
  const thisYear = new Date().getUTCFullYear();
  const firstYear = user?.created_at ? new Date(user.created_at).getUTCFullYear() : thisYear;
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);
  return { login: user?.login ?? login, user, edges, trustStatus: trust.status, activity, calendar, years, githubError };
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
