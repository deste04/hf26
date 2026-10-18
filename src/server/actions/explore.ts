// Explore's data: a project's VOUCHED.td or a person's entries, read live from GitHub (see ../vouch.ts).
import { cleanQuery } from "../../lib/query";
import { repoActivity } from "../github";
import { rateLimited } from "../githubCore";
import type { TrustEdge } from "../trust/types";
import { attributeEdges, projectEdges, userListings } from "../vouch";

export type ExploreResult = {
  kind: "user" | "project";
  q: string;
  edges: TrustEdge[];
  /** Why GitHub returned nothing, when it didn't: no VOUCHED.td, person search without a token, a rate limit, or an API error. */
  issue: null | "no_vouch_file" | "needs_token" | "rate_limited" | "unavailable";
};

export async function exploreSearch(raw: string): Promise<ExploreResult> {
  const q = cleanQuery(raw);
  const kind = q.includes("/") ? ("project" as const) : ("user" as const);
  let edges: TrustEdge[] = [];
  let issue: ExploreResult["issue"] = null;
  if (kind === "project") {
    try {
      const p = await projectEdges(q);
      if (p) edges = p.edges;
      else issue = "no_vouch_file";
    } catch {
      issue = "unavailable";
    }
  } else {
    // Vouchers are left out here (see vouchersFor) so the map can draw before the slow blame reads finish.
    const u = await userListings(q);
    if (u.status === "ok") edges = u.edges;
    else issue = u.status;
  }
  if (issue === "unavailable" && rateLimited()) issue = "rate_limited";
  return { kind, q, edges, issue };
}

/** Person search: the same entries with their vouchers, for the page to swap in when ready. */
export async function vouchersFor(login: string, edges: TrustEdge[]): Promise<TrustEdge[]> {
  return attributeEdges(cleanQuery(login), edges);
}

/**
 * Repos a person ever contributed to without a vouch list entry there, busiest first. Separate from
 * exploreSearch so the page can draw the trust graph first and add these when they arrive.
 */
export async function activityOnly(login: string, edges: TrustEdge[]): Promise<string[]> {
  const counts = await repoActivity(cleanQuery(login)).catch(() => null);
  const listed = new Set(edges.map((e) => e.project.toLowerCase()));
  const total = (n: { commits: number; prs: number; issues: number; reviews: number }) => n.commits + n.prs + n.issues + n.reviews;
  return Object.entries(counts ?? {})
    .filter(([repo]) => !listed.has(repo.toLowerCase()))
    .sort(([, a], [, b]) => total(b) - total(a))
    .map(([repo]) => repo);
}
