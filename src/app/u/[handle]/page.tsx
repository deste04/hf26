import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { BriefCard } from "@/components/BriefCard";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import { GithubMark, LinkButton } from "@/components/LinkButton";
import { cleanQuery } from "@/lib/query";
import { accountYears, profileActivity, profileCalendar, profileUser } from "@/server/profile";
import "./profile.css";

type Params = Promise<{ handle: string }>;
const plural = (n: number) => (n === 1 ? "" : "s");

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

/**
 * Shows the header as soon as the user record arrives (one cached call); vouch badges, the calendar and the
 * activity table each stream in under their own Suspense, so a slow first read of the vouch lists holds back
 * only the parts that need it.
 */
async function Profile({ params }: { params: Params }) {
  // Live GitHub data for one person: always rendered per request, never prerendered.
  await connection();
  const { handle } = await params;
  const login = cleanQuery(decodeURIComponent(handle));
  const { user, error } = await profileUser(login);
  const shown = user?.login ?? login;

  return (
    <main className="container profile-page">
      <aside className="card profile-aside" aria-labelledby="profile-handle">
        <Avatar name={user?.name ?? shown} src={user?.avatar_url ?? undefined} size="xl" />
        <div className="profile-id">
          <h1 id="profile-handle">@{shown}</h1>
          {user?.name && <span className="profile-name">{user.name}</span>}
          <span className="muted small">Public GitHub activity only</span>
        </div>
        <Suspense fallback={<Skeleton label="Reading vouch lists" lines={1} />}>
          <TrustSummary login={login} />
        </Suspense>
        <LinkButton href={`https://github.com/${shown}`} external icon={<GithubMark />}>
          View on GitHub
        </LinkButton>
        {error && <p className="muted small">GitHub isn&apos;t answering; some details may be missing.</p>}
      </aside>

      <div className="profile-main">
        <BriefCard login={shown} />
        <Suspense fallback={<SectionSkeleton title="GitHub activity" label="Loading the contribution calendar" />}>
          <CalendarSection login={shown} years={accountYears(user)} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Activity by project" label="Reading activity from GitHub" />}>
          <ActivitySection login={login} />
        </Suspense>
      </div>
    </main>
  );
}

function SectionSkeleton({ title, label }: { title: string; label: string }) {
  return (
    <section className="card profile-section">
      <h2>{title}</h2>
      <Skeleton label={label} lines={4} />
    </section>
  );
}

/** Vouch badges. Shown only when the vouch lists could be searched: an unknown is never "not vouched". */
async function TrustSummary({ login }: { login: string }) {
  const { trust, edges, rows } = await profileActivity(login);
  if (trust.status !== "ok") return null;
  const vouched = edges.filter((e) => e.status === "vouched").length;
  const denounced = edges.filter((e) => e.status === "denounced").length;
  // Repos with activity but no entry in their VOUCHED.td.
  const notVouched = rows.filter((r) => !r.vouch).length;
  // The projects themselves are in the activity table (Vouch column); the card keeps only the counts.
  return (
    <div className="profile-pills">
      <Badge tone="success">Vouched in {vouched} project{plural(vouched)}</Badge>
      {notVouched > 0 && <Badge tone="neutral">Not vouched in {notVouched} repo{plural(notVouched)}</Badge>}
      {denounced > 0 && <Badge tone="danger">Denounced in {denounced}</Badge>}
    </div>
  );
}

async function CalendarSection({ login, years }: { login: string; years: number[] }) {
  const calendar = await profileCalendar(login);
  if (!calendar) return null;
  return (
    <section className="card profile-section" aria-labelledby="calendar-title">
      <h2 id="calendar-title">GitHub activity</h2>
      <ContributionHeatmap login={login} initial={calendar} years={years} />
    </section>
  );
}

async function ActivitySection({ login }: { login: string }) {
  const { rows, period, trust, error } = await profileActivity(login);
  const showVouch = trust.status === "ok";
  return (
    <section className="card profile-section" aria-labelledby="activity-title">
      <div className="activity-head">
        <h2 id="activity-title">Activity by project</h2>
        <span className="muted small">{period === "all years" ? "Every repo, all years" : "Recent activity"}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{error ? "GitHub isn't answering right now." : "No public activity found."}</p>
      ) : (
        <div className="table-wrap">
          <table className="table profile-table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Commits</th>
                <th scope="col">PRs</th>
                <th scope="col">Issues</th>
                <th scope="col">Reviews</th>
                {showVouch && <th scope="col">Vouch</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.repo}>
                  <td>
                    <a href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer" className="mono">
                      {r.repo}
                    </a>
                  </td>
                  <td>{r.commits}</td>
                  <td>{r.prs}</td>
                  <td>{r.issues}</td>
                  <td>{r.reviews}</td>
                  {showVouch && (
                    <td>
                      {r.vouch === "vouched" ? (
                        <Badge tone="success" size="sm">Vouched</Badge>
                      ) : r.vouch === "denounced" ? (
                        <Badge tone="danger" size="sm">Denounced</Badge>
                      ) : (
                        <span className="muted">Not listed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
