import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { ExploreEmpty } from "@/components/ExploreEmpty";
import { GithubMark, LinkButton } from "@/components/LinkButton";
import { SearchBar } from "@/components/SearchBar";
import { ActivityCount, ResultView } from "@/components/ResultGraph";
import { cleanQuery } from "@/lib/query";
import { activityOnly, exploreSearch, vouchersFor, type ExploreResult } from "@/server/actions/explore";

const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, other: string) => `${fmt(n)} ${n === 1 ? one : other}`;

type Search = Promise<{ q?: string }>;

/** The shell (title, panels) prerenders; the search, which reads the URL, streams in under Suspense. */
export default function ExplorePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="container explore">
      <section className="explore-hero" aria-labelledby="explore-title">
        <div className="explore-intro">
          <h1 id="explore-title">Check who's trusted before AI slop lands in your PRs</h1>
          <p>
            Projects answer with <span className="mono">VOUCHED.td</span> lists, but every list is an island: someone vouched in
            five repos starts from zero in the sixth. Vouch Explorer joins them into one graph. Search a person to see who vouches
            for them, or a project to see who it trusts.
          </p>
        </div>
        <Suspense fallback={<SearchBar defaultValue="" />}>
          <HeroSearch searchParams={searchParams} />
        </Suspense>
      </section>

      <div className="grid-2">
        <section className="stack" aria-label="Trust graph">
          <Suspense fallback={<div className="card"><Skeleton label="Reading VOUCHED.td from GitHub" lines={6} /></div>}>
            <Results searchParams={searchParams} />
          </Suspense>
        </section>
        <aside className="stack" aria-label="Recent vouches">
          <ExploreEmpty scene="inbox" title="Recent vouches" line="Nothing yet. New VOUCHED.td entries will show up here." />
        </aside>
      </div>
    </div>
  );
}

async function HeroSearch({ searchParams }: { searchParams: Search }) {
  const q = cleanQuery((await searchParams).q ?? "");
  return <SearchBar key={q} defaultValue={q && !q.includes("/") ? `@${q}` : q} />;
}

async function Results({ searchParams }: { searchParams: Search }) {
  const q = cleanQuery((await searchParams).q ?? "");
  // Live GitHub reads for whatever was searched: rendered per request, never prerendered.
  await connection();
  if (!q) return <ExploreEmpty scene="search" title="Search a person or a project" line="Try @handle or owner/repo." />;
  const result = await exploreSearch(q);
  const person = result.kind === "user" && !result.issue;
  // Started now and handed to the page as promises: the map draws from the entries alone and fills these in later.
  const vouchers = person && result.edges.length > 0 ? vouchersFor(result.q, result.edges) : null;
  const activity = person ? activityOnly(result.q, result.edges) : Promise.resolve([]);
  // No vouch entries: the graph has only activity to show, so this one case waits for it.
  if (result.edges.length === 0 && (await activity).length === 0) return <NoResult result={result} />;

  const title = result.kind === "user" ? `@${result.q}` : result.q;
  const vouched = result.edges.filter((e) => e.status === "vouched").length;
  const denounced = result.edges.length - vouched;
  const header = (
    <div className="card-head">
      <div className="result-head">
        <h2>
          <span className={result.kind === "project" ? "mono" : undefined}>{title}</span>
        </h2>
        <span className="muted small">
          {result.kind === "user"
            ? `Listed in ${plural(result.edges.length, "project", "projects")}`
            : plural(result.edges.length, "listed user", "listed users")}
          {vouched > 0 && <> · <span className="tone-success">{fmt(vouched)} vouched</span></>}
          {denounced > 0 && <> · <span className="tone-danger">{fmt(denounced)} denounced</span></>}
          <Suspense fallback={null}>
            <ActivityCount activity={activity} />
          </Suspense>
        </span>
      </div>
      {result.kind === "user" ? (
        <LinkButton href={`/u/${encodeURIComponent(result.q)}`}>Open profile</LinkButton>
      ) : (
        <LinkButton href={`https://github.com/${result.q}`} external icon={<GithubMark />}>View on GitHub</LinkButton>
      )}
    </div>
  );
  return (
    // Keyed by the query: clicking a node navigates client-side, and React would otherwise reuse the previous
    // search's component, still holding its vouchers, activity and table filters until the new ones arrive.
    <ResultView
      key={`${result.kind}:${result.q.toLowerCase()}`}
      header={header}
      center={{ kind: result.kind, id: result.q }}
      edges={result.edges}
      vouchers={vouchers}
      activity={activity}
    />
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
