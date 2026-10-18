"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ExploreEmpty } from "@/components/ExploreEmpty";
import { GraphLoader } from "@/components/GraphLoader";
import { GithubMark, LinkButton } from "@/components/LinkButton";
import TrustGraph from "@/components/TrustGraph";
import { TrustTable } from "@/components/TrustTable";
import type { ExploreResult } from "@/server/actions/explore";
import type { TrustEdge } from "@/server/trust/types";

const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, other: string) => `${fmt(n)} ${n === 1 ? one : other}`;

async function getPart<T>(q: string, part: "list" | "vouchers" | "activity", signal: AbortSignal): Promise<T> {
  const res = await fetch(`/api/trust?q=${encodeURIComponent(q)}&part=${part}`, { signal });
  if (!res.ok) throw new Error(`GET /api/trust ${res.status}`);
  return res.json();
}

/** True once the window's load event has fired: the page, its styles and fonts are all in. */
function usePageLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") return setLoaded(true);
    const done = () => setLoaded(true);
    window.addEventListener("load", done, { once: true });
    return () => window.removeEventListener("load", done);
  }, []);
  return loaded;
}

/**
 * Explore results, fetched from the browser only after the page has fully loaded, so the search never holds it.
 * The list of entries comes first; vouchers (slow: one blame per list) and the person's activity-only repos are
 * fetched alongside. A loader stays up until all three are in, so the graph is drawn once, complete.
 */
export function ExploreResults({ q }: { q: string }) {
  const loaded = usePageLoaded();
  const list = useQuery({
    queryKey: ["explore", q, "list"],
    queryFn: ({ signal }) => getPart<ExploreResult>(q, "list", signal),
    enabled: loaded,
  });
  const result = list.data;
  const person = result?.kind === "user" && !result.issue;
  const needsVouchers = person && (result?.edges.length ?? 0) > 0;
  const vouchers = useQuery({
    queryKey: ["explore", q, "vouchers"],
    queryFn: ({ signal }) => getPart<TrustEdge[]>(q, "vouchers", signal),
    enabled: needsVouchers,
  });
  const activity = useQuery({
    queryKey: ["explore", q, "activity"],
    queryFn: ({ signal }) => getPart<string[]>(q, "activity", signal),
    enabled: person,
  });

  if (list.isError) return <ExploreEmpty scene="offline" title="GitHub isn't answering" line="Try again in a minute." />;
  if (!result) return <GraphLoader label="Reading VOUCHED.td from GitHub" />;
  if (needsVouchers && vouchers.isPending) return <GraphLoader label="Finding who vouched" />;
  if (person && activity.isPending) return <GraphLoader label="Reading GitHub activity" />;
  const repos = activity.data ?? [];
  if (result.edges.length === 0 && repos.length === 0) return <NoResult result={result} />;

  const edges = vouchers.data ?? result.edges;
  const title = result.kind === "user" ? `@${result.q}` : result.q;
  const vouched = edges.filter((e) => e.status === "vouched").length;
  const denounced = edges.length - vouched;
  const center = { kind: result.kind, id: result.q };
  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="result-head">
            <h2>
              <span className={result.kind === "project" ? "mono" : undefined}>{title}</span>
            </h2>
            <span className="muted small">
              {result.kind === "user"
                ? `Listed in ${plural(edges.length, "project", "projects")}`
                : plural(edges.length, "listed user", "listed users")}
              {vouched > 0 && <> · <span className="tone-success">{fmt(vouched)} vouched</span></>}
              {denounced > 0 && <> · <span className="tone-danger">{fmt(denounced)} denounced</span></>}
              {repos.length > 0 && <> · {plural(repos.length, "other repo", "other repos")} with activity</>}
            </span>
          </div>
          {result.kind === "user" ? (
            <LinkButton href={`/u/${encodeURIComponent(result.q)}`}>Open profile</LinkButton>
          ) : (
            <LinkButton href={`https://github.com/${result.q}`} external icon={<GithubMark />}>View on GitHub</LinkButton>
          )}
        </div>
        <TrustGraph center={center} edges={edges} activity={repos} />
      </div>
      {edges.length > 0 && <TrustTable kind={center.kind} edges={edges} />}
    </>
  );
}

function NoResult({ result }: { result: ExploreResult }) {
  const { q, issue } = result;
  const profile = <LinkButton href={`/u/${encodeURIComponent(q)}`}>Open profile</LinkButton>;
  if (issue === "unavailable") return <ExploreEmpty scene="offline" title="GitHub isn't answering" line="Try again in a minute." />;
  // Without a token person search is off; that is a setup detail (logged on the server), so offer the profile instead.
  if (issue === "needs_token")
    return <ExploreEmpty scene="search" title={`@${q}`} line="See their GitHub activity on the profile." action={profile} />;
  if (result.kind === "project") return <ExploreEmpty scene="map" title="No VOUCHED.td here" line={`${q} has no vouch list.`} />;
  return <ExploreEmpty scene="search" title="Not in any vouch list" line={`No VOUCHED.td names @${q}.`} action={profile} />;
}
