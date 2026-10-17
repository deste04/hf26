// Explore's data: a project's VOUCHED.td or a person's entries, read live from GitHub (see ../vouch.ts).
import { cleanQuery } from "../../lib/query";
import type { TrustEdge } from "../trust/types";
import { projectEdges, userEdges } from "../vouch";

export type ExploreResult = {
  kind: "user" | "project";
  q: string;
  edges: TrustEdge[];
  /** Why GitHub returned nothing, when it didn't: no VOUCHED.td, person search without a token, or an API error. */
  issue: null | "no_vouch_file" | "needs_token" | "unavailable";
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
    const u = await userEdges(q);
    if (u.status === "ok") edges = u.edges;
    else issue = u.status;
  }
  return { kind, q, edges, issue };
}
