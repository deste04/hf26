import Link from "next/link";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BriefCard } from "@/components/BriefCard";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import { GithubMark, LinkButton } from "@/components/LinkButton";
import { SampleChip } from "@/components/SampleChip";
import { getProfileData } from "@/server/actions/pages";
import "./profile.css";
import { cleanQuery } from "@/lib/query";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const login = cleanQuery(decodeURIComponent(handle));
  const data = await getProfileData(login);
  const vouched = data.edges.filter((e) => e.status === "vouched");
  const denounced = data.edges.filter((e) => e.status === "denounced");
  const unknownVoucher = vouched.filter((e) => !e.voucher);
  const anySeed = data.edges.some((e) => e.is_seed === 1);
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

        <div className="profile-pills">
          <Badge tone="success">
            Vouched in {vouched.length} project{plural(vouched.length)}
          </Badge>
          {unknownVoucher.length > 0 && <Badge tone="neutral">Unknown voucher in {unknownVoucher.length}</Badge>}
          {denounced.length > 0 && <Badge tone="danger">Denounced in {denounced.length}</Badge>}
        </div>

        <div className="profile-vouchers">
          <span className="profile-label">Vouched by</span>
          {vouched.length === 0 ? (
            <span className="muted small">Not vouched in any indexed VOUCHED.td.</span>
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
                  </Link>{" "}
                  <SampleChip show={e.is_seed === 1} />
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
        </div>

        <LinkButton href={`https://github.com/${data.login}`} external icon={<GithubMark />}>
          View on GitHub
        </LinkButton>
        {anySeed && <SampleChip show />}
        {data.githubError && <p className="muted small">GitHub unavailable; showing cached data where possible.</p>}
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
                    <th scope="col">Vouch</th>
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
                      <td>
                        {r.vouch === "vouched" ? (
                          <Badge tone="success" size="sm">Vouched</Badge>
                        ) : r.vouch === "denounced" ? (
                          <Badge tone="danger" size="sm">Denounced</Badge>
                        ) : (
                          <span className="muted">Not listed</span>
                        )}
                      </td>
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
