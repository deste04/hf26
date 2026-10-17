import Link from "next/link";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { GithubMark, LinkButton } from "@/components/LinkButton";
import SampleChip from "@/components/SampleChip";
import { SearchBar } from "@/components/SearchBar";
import TrustGraph from "@/components/TrustGraph";
import { TrustTable } from "@/components/TrustTable";
import { exploreSearch, indexStats } from "@/server/actions/explore";
import { cleanQuery } from "@/lib/query";

export const dynamic = "force-dynamic";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const VERB = { vouch: "vouched", denounce: "denounced", remove: "removed" } as Record<string, string>;
const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, other: string) => `${fmt(n)} ${n === 1 ? one : other}`;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const stats = await indexStats();
  const { q: rawQ } = await searchParams;
  const q = cleanQuery(rawQ ?? "");
  const result = q ? await exploreSearch(q) : null;
  const anySeed = !!result?.edges.some((e) => e.is_seed);
  const title = result ? (result.kind === "user" ? `@${result.q}` : result.q) : "";
  const vouched = result?.edges.filter((e) => e.status === "vouched").length ?? 0;
  const denounced = (result?.edges.length ?? 0) - vouched;
  const indexEmpty = stats.projects === 0;

  return (
    <div className="container explore">
      <section className="explore-hero" aria-labelledby="explore-title">
        <div className="explore-intro">
          <h1 id="explore-title">Who is trusted where?</h1>
          <p>
            A map of public <span className="mono">VOUCHED.td</span> files across GitHub. Search a contributor to see which
            projects vouch for them, or a project to see who it trusts.
          </p>
        </div>

        <SearchBar defaultValue={q ? (result?.kind === "user" ? `@${q}` : q) : ""} />

        {(stats.suggestions.length > 0 || stats.projectSuggestions.length > 0) && (
          <div className="suggest">
            {stats.projectSuggestions.length > 0 && (
              <div className="suggest-row">
                <span className="suggest-label">Projects</span>
                {stats.projectSuggestions.map((p) => (
                  <Link key={p} className="pill mono" href={`/?q=${encodeURIComponent(p)}`} aria-current={result?.q === p ? "true" : undefined}>
                    {p}
                  </Link>
                ))}
              </div>
            )}
            {stats.suggestions.length > 0 && (
              <div className="suggest-row">
                <span className="suggest-label">People</span>
                {stats.suggestions.slice(0, 6).map((s) => (
                  <Link key={s} className="pill mono" href={`/?q=${encodeURIComponent(s)}`} aria-current={result?.q === s ? "true" : undefined}>
                    @{s}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <dl className="stat-strip" aria-label="Index">
          <div className="stat"><dt>Projects with VOUCHED.td</dt><dd>{fmt(stats.projects)}</dd></div>
          <div className="stat"><dt>Vouched contributors</dt><dd>{fmt(stats.vouched)}</dd></div>
          <div className="stat"><dt>Denounced</dt><dd className="tone-danger">{fmt(stats.denounced)}</dd></div>
          <div className="stat"><dt>Vouch events</dt><dd>{fmt(stats.events)}</dd></div>
        </dl>
        {stats.shared && (
          <p className="stat-note muted small">
            Shared index: {fmt(stats.shared.projects)} projects · {fmt(stats.shared.vouched)} vouched ·{" "}
            {fmt(stats.shared.denounced)} denounced
          </p>
        )}
      </section>

      <div className="grid-2">
        <section className="stack" aria-label="Trust graph">
          {result && result.edges.length > 0 ? (
            <>
              <div className="card">
                <div className="card-head">
                  <div className="result-head">
                    <h2>
                      <span className={result.kind === "project" ? "mono" : undefined}>{title}</span>
                    </h2>
                    <span className="muted small">
                      {result.kind === "user"
                        ? `Listed in ${plural(result.edges.length, "project", "projects")}`
                        : `${plural(result.edges.length, "listed user", "listed users")}`}
                      {" · "}
                      <span className="tone-success">{fmt(vouched)} vouched</span>
                      {denounced > 0 && <> · <span className="tone-danger">{fmt(denounced)} denounced</span></>}
                    </span>
                  </div>
                  <div className="row">
                    <SampleChip show={anySeed} />
                    {result.kind === "user" ? (
                      <LinkButton href={`/u/${encodeURIComponent(result.q)}`}>Open profile</LinkButton>
                    ) : (
                      <LinkButton href={`https://github.com/${result.q}`} external icon={<GithubMark />}>View on GitHub</LinkButton>
                    )}
                  </div>
                </div>
                <TrustGraph center={{ kind: result.kind, id: result.q }} edges={result.edges} />
              </div>
              <TrustTable kind={result.kind} edges={result.edges} />
            </>
          ) : (
            <div className="card">
              {indexEmpty ? (
                <EmptyState
                  title="The index is empty"
                  description="Run npm run crawl to find public VOUCHED.td files, or npm run crawl -- --repo owner/name for one project."
                />
              ) : !q ? (
                <EmptyState
                  title="Search a contributor or a project"
                  description="Enter a GitHub handle to see which projects vouch for them, or owner/repo to see who a project trusts. Or pick one of the suggestions above."
                />
              ) : result?.kind === "user" ? (
                <EmptyState
                  title={`@${q} isn't in any vouch list`}
                  description="No indexed VOUCHED.td lists this handle. Their public GitHub activity is still on their profile."
                  action={<LinkButton href={`/u/${encodeURIComponent(q)}`}>Open @{q}&apos;s profile</LinkButton>}
                />
              ) : (
                <EmptyState
                  title={`${q} isn't indexed`}
                  description="Either the project has no VOUCHED.td or the crawler hasn't reached it yet. Try one of the projects above."
                />
              )}
            </div>
          )}
        </section>

        <aside className="stack" aria-label="Recent vouches">
          <section className="card">
            <h2 className="card-title">Recent vouches</h2>
            {stats.recent.length === 0 ? (
              <p className="muted small">No events yet.</p>
            ) : (
              <ol className="event-list">
                {stats.recent.map((ev) => (
                  <li key={ev.id}>
                    <span className={`event-dot is-${ev.action}`} aria-hidden="true" />
                    <div>
                      <span>
                        <Link href={`/u/${encodeURIComponent(ev.login)}`}><strong>@{ev.login}</strong></Link>{" "}
                        {VERB[ev.action] ?? ev.action} in{" "}
                        <Link className="mono" href={`/?q=${encodeURIComponent(ev.project)}`}>{ev.project}</Link>{" "}
                        <SampleChip show={ev.is_seed} />
                      </span>
                      <span className="meta">
                        {ev.voucher ? <>by <Link href={`/u/${encodeURIComponent(ev.voucher)}`}>@{ev.voucher}</Link> · </> : null}
                        <time dateTime={ev.occurred_at ?? undefined}>{fmtDate(ev.occurred_at)}</time>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
