import { Suspense } from "react";
import { ExploreEmpty } from "@/components/ExploreEmpty";
import { GraphLoader } from "@/components/GraphLoader";
import { SearchBar } from "@/components/SearchBar";
import { ExploreResults } from "@/components/ResultGraph";
import { cleanQuery } from "@/lib/query";

type Search = Promise<{ q?: string }>;

/** The shell (title, panels) prerenders; the search, which reads the URL, streams in under Suspense. */
export default function ExplorePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="container explore">
      <section className="explore-hero" aria-labelledby="explore-title">
        <div className="explore-intro">
          <h1 id="explore-title">Check who's trusted before AI slop lands in your PRs</h1>
          <p>
            Vouch Explorer joins every project's <span className="mono">VOUCHED.td</span> list into one graph. Search a person
            to see who vouches for them, or a project to see who it trusts.
          </p>
        </div>
        <Suspense fallback={<SearchBar defaultValue="" />}>
          <HeroSearch searchParams={searchParams} />
        </Suspense>
      </section>

      <div className="grid-2">
        <section className="stack" aria-label="Trust graph">
          <Suspense fallback={<GraphLoader label="Reading VOUCHED.td from GitHub" />}>
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
  if (!q) return <ExploreEmpty scene="search" title="Search a person or a project" line="Try @handle or owner/repo." />;
  // The browser fetches the results once the page has loaded. Keyed by the query: clicking a node navigates
  // client-side, and React would otherwise reuse the previous search's component and its table filters.
  return <ExploreResults key={q.toLowerCase()} q={q} />;
}
