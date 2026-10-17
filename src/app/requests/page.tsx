import Link from "next/link";
import { RequestList } from "@/components/RequestList";
import { listRequestProjects, listRequests } from "@/server/actions/pages";
import { getCurrentUser } from "@/server/auth";
import "./requests.css";

export const dynamic = "force-dynamic";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project: wanted } = await searchParams;
  const projects = await listRequestProjects();
  const current =
    projects.find((p) => p.full_name === wanted) ?? projects[0] ?? null;
  const requests = current ? await listRequests(current.id) : [];
  const me = getCurrentUser();

  return (
    <main className="container req-page">
      <div className="req-title">
        <h1>Vouch requests</h1>
        {current && <span className="mono muted">maintainer view · {current.full_name}</span>}
      </div>
      <p className="muted small">
        Signed in as <span className="mono">{me.login}</span> (demo). AI summarises, you decide.
      </p>
      {projects.length === 0 ? (
        <p className="muted">
          No requests yet. Run <span className="mono">npm run db:seed</span>.
        </p>
      ) : (
        <>
          <nav className="req-picker" aria-label="Choose project">
            <span className="small muted">Project</span>
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/requests?project=${encodeURIComponent(p.full_name)}`}
                className={`req-picker-link mono${p.id === current?.id ? " is-current" : ""}`}
                aria-current={p.id === current?.id ? "page" : undefined}
              >
                {p.full_name}
              </Link>
            ))}
          </nav>
          {current && (
            <RequestList key={current.id} initial={requests} project={current.full_name} isSeed={requests.some((r) => r.is_seed === 1)} />
          )}
        </>
      )}
    </main>
  );
}
