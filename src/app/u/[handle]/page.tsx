import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BriefCard } from "@/components/BriefCard";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import { GithubMark, LinkButton } from "@/components/LinkButton";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { cleanQuery } from "@/lib/query";
import { getProfileData } from "@/server/actions/pages";
import "./profile.css";

type Params = Promise<{ handle: string }>;

/** The handle comes from the URL, so the profile streams in under Suspense (Cache Components). */
export default function ProfilePage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <main className="container profile-page">
          <aside className="card profile-aside"><Skeleton label="Loading profile" avatar lines={3} /></aside>
          <div className="profile-main"><div className="card"><Skeleton label="Loading activity" lines={5} /></div></div>
        </main>
      }
    >
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: Params }) {
  // Live GitHub data for one person: always rendered per request, never prerendered.
  await connection();
  const { handle } = await params;
  const login = cleanQuery(decodeURIComponent(handle));
  const data = await getProfileData(login);
  const vouched = data.edges.filter((e) => e.status === "vouched");
  const denounced = data.edges.filter((e) => e.status === "denounced");
  const unknownVoucher = vouched.filter((e) => !e.voucher);
  const plural = (n: number) => (n === 1 ? "" : "s");

  return (
    <main className="container profile-page">
      <aside className="card profile-aside" aria-labelledby="profile-handle">
        <Avatar name={data.user?.name ?? data.login} src={data.user?.avatar_url ?? undefined} size="xl" />
        <div className="profile-id">
          <h1 id="profile-handle">@{data.login}</h1>
          {data.user?.name && <span className="profile-name">{data.user.name}</span>}
          <span className="muted small">Public GitHub activity only</span>
        </div>

        {data.trustStatus === "ok" && <div className="profile-pills">
          <Badge tone="success">
            Vouched in {vouched.length} project{plural(vouched.length)}
          </Badge>
          {unknownVoucher.length > 0 && <Badge tone="neutral">Unknown voucher in {unknownVoucher.length}</Badge>}
          {denounced.length > 0 && <Badge tone="danger">Denounced in {denounced.length}</Badge>}
        </div>}

        {/* Shown only when the vouch lists could actually be searched: an unknown is never presented as "not vouched". */}
        {data.trustStatus === "ok" && <div className="profile-vouchers">
          <span className="profile-label">Vouched by</span>
          {vouched.length === 0 ? (
            <span className="muted small">Not vouched in any VOUCHED.td GitHub found.</span>
          ) : (
            <ul>
              {vouched.map((e) => (
                <li key={e.project}>
                  {e.voucher ? (
                    <Link href={`/u/${e.voucher}`}>@{e.voucher}</Link>
                  ) : (
                    <span className="muted">unknown</span>
                  )}{" "}
                  ·{" "}
                  <Link href={`/?q=${encodeURIComponent(e.project)}`} className="mono">
                    {e.project}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {denounced.length > 0 && (
            <>
              <span className="profile-label">Denounced in</span>
              <ul>
                {denounced.map((e) => (
                  <li key={e.project}>
                    <Link href={`/?q=${encodeURIComponent(e.project)}`} className="mono">
                      {e.project}
                    </Link>
                    {e.note && <span className="muted small"> — “{e.note}”</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>}

        <LinkButton href={`https://github.com/${data.login}`} external icon={<GithubMark />}>
          View on GitHub
        </LinkButton>
        {data.githubError && <p className="muted small">GitHub isn&apos;t answering; some activity may be missing.</p>}
      </aside>

      <div className="profile-main">
        <BriefCard login={data.login} />

        {data.calendar && (
          <section className="card profile-section" aria-labelledby="calendar-title">
            <h2 id="calendar-title">GitHub activity</h2>
            <ContributionHeatmap login={data.login} initial={data.calendar} years={data.years} />
          </section>
        )}

        <section className="card profile-section" aria-labelledby="activity-title">
          <h2 id="activity-title">Activity by project</h2>
          {data.activity.length === 0 ? (
            <p className="muted">No public activity found.</p>
          ) : (
            <div className="table-wrap">
              <table className="table profile-table">
                <thead>
                  <tr>
                    <th scope="col">Project</th>
                    <th scope="col">PRs merged</th>
                    <th scope="col">PRs closed</th>
                    <th scope="col">Reviews</th>
                    {data.trustStatus === "ok" && <th scope="col">Vouch</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.activity.map((r) => (
                    <tr key={r.repo}>
                      <td>
                        <a href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer" className="mono">
                          {r.repo}
                        </a>
                      </td>
                      <td>{r.merged}</td>
                      <td>{r.closed}</td>
                      <td>{r.reviews}</td>
                      {data.trustStatus === "ok" && <td>
                        {r.vouch === "vouched" ? (
                          <Badge tone="success" size="sm">Vouched</Badge>
                        ) : r.vouch === "denounced" ? (
                          <Badge tone="danger" size="sm">Denounced</Badge>
                        ) : (
                          <span className="muted">Not listed</span>
                        )}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
