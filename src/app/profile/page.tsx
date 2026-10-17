import Link from "next/link";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { redirect } from "next/navigation";
import { indexStats } from "@/server/actions/explore";
import { cleanQuery } from "@/lib/query";

export const dynamic = "force-dynamic";

const TEAM = (process.env.NEXT_PUBLIC_TEAM ?? "Calonca,deste04,fabianhogger").split(",");

/** /profile?q=handle → /u/handle. Without q: a lookup page instead of defaulting to one person. */
export default async function ProfileLookup({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = cleanQuery((await searchParams).q ?? "");
  if (q.includes("/")) redirect(`/?q=${encodeURIComponent(q)}`); // owner/repo is a project, not a person
  if (q) redirect(`/u/${encodeURIComponent(q)}`);
  const { suggestions } = await indexStats();

  return (
    <div className="container">
      <section className="hero">
        <h1>Look up a contributor</h1>
        <p>Public GitHub activity, vouch entries and an AI brief for any GitHub handle.</p>
        <form className="search-form" action="/profile" method="get" role="search">
          <Input id="q" name="q" label="GitHub handle" placeholder="e.g. @deste04" autoComplete="off" required />
          <Button type="submit">Show profile</Button>
        </form>
        <div className="row small muted">
          <span>Team:</span>
          {TEAM.map((t) => (
            <Link key={t} className="mono" href={`/u/${t}`}>@{t}</Link>
          ))}
        </div>
        {suggestions.length > 0 && (
          <div className="row small muted">
            <span>Most vouched:</span>
            {suggestions.slice(0, 6).map((s) => (
              <Link key={s} className="mono" href={`/u/${encodeURIComponent(s)}`}>@{s}</Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
