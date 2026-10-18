import Link from "next/link";

/** Real searches with something to show: a person in a few lists, a big project list, and Vouch's own. */
const EXAMPLES = [
  { q: "ericallam", label: "@ericallam", hint: "a person" },
  { q: "ghostty-org/ghostty", label: "ghostty-org/ghostty", hint: "a project" },
  { q: "mitchellh/vouch", label: "mitchellh/vouch", hint: "a project" },
];

/** The sketch's satellites around the centre: where they sit and what kind of link joins them. */
const NODES = [
  { x: 92, y: 62, tone: "ok", label: "acme/cli" },
  { x: 268, y: 46, tone: "ok", label: "acme/web" },
  { x: 318, y: 150, tone: "ok", label: "kit/core" },
  { x: 250, y: 238, tone: "bad", label: "foo/bar" },
  { x: 74, y: 214, tone: "ok", label: "org/app" },
  { x: 40, y: 132, tone: "activity", label: "lab/docs" },
] as const;
const CENTER = { x: 180, y: 140 };

/** Explore before any search: what the graph will show, a key to read it, and searches to start from. */
export function ExploreStart() {
  return (
    <section className="card explore-start" aria-labelledby="explore-start-title">
      <div className="explore-start-copy">
        <h2 id="explore-start-title">Search a person or a project</h2>
        <p>
          A person shows every project that vouches for or denounces them. A project shows everyone on its list and who
          added them.
        </p>
        <div className="explore-start-examples">
          <span className="muted small">Try</span>
          {EXAMPLES.map((e) => (
            <Link key={e.q} href={`/?q=${encodeURIComponent(e.q)}`} className="explore-start-chip" title={`Search ${e.hint}`}>
              <span className={e.q.includes("/") ? "mono" : undefined}>{e.label}</span>
            </Link>
          ))}
        </div>
        <div className="legend" aria-hidden="true">
          <span><i style={{ borderColor: "var(--success)" }} /> Vouched</span>
          <span><i style={{ borderColor: "var(--danger)" }} /> Denounced</span>
          <span><i style={{ borderColor: "var(--text-muted)", borderTopStyle: "dotted" }} /> Activity only</span>
        </div>
      </div>
      <svg className="explore-start-art" viewBox="0 0 360 280" role="img" aria-label="Sketch of a trust graph: one centre linked to the projects around it">
        {NODES.map((n, i) => (
          <line key={i} x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y} data-tone={n.tone} style={{ animationDelay: `${i * 90}ms` }} />
        ))}
        {NODES.map((n, i) => (
          <g key={i} style={{ animationDelay: `${200 + i * 90}ms` }}>
            <circle cx={n.x} cy={n.y} r={n.tone === "activity" ? 6 : 8} data-tone={n.tone} style={{ animationDelay: "inherit" }} />
            <text x={n.x} y={n.y < CENTER.y ? n.y - 16 : n.y + 24} textAnchor="middle" className="explore-start-node-label" style={{ animationDelay: "inherit" }}>
              {n.label}
            </text>
          </g>
        ))}
        <rect x={CENTER.x - 46} y={CENTER.y - 17} width="92" height="34" rx="17" className="explore-start-center" />
        <text x={CENTER.x} y={CENTER.y + 5} textAnchor="middle" className="explore-start-center-label">@handle</text>
      </svg>
    </section>
  );
}
