"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import type { TrustEdge } from "@/server/trust/types";

type Status = "all" | "vouched" | "denounced";
const PAGE = 50;

/** Entries behind the trust graph, with a status filter and a text filter. Empty columns are left out. */
export function TrustTable({ kind, edges }: { kind: "user" | "project"; edges: TrustEdge[] }) {
  const [status, setStatus] = useState<Status>("all");
  const [text, setText] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(
    () => ({
      all: edges.length,
      vouched: edges.filter((e) => e.status === "vouched").length,
      denounced: edges.filter((e) => e.status === "denounced").length,
    }),
    [edges],
  );
  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase().replace(/^@/, "");
    return edges.filter(
      (e) =>
        (status === "all" || e.status === status) &&
        (!needle || [e.project, e.login, e.voucher ?? "", e.note ?? ""].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [edges, status, text]);
  const showVoucher = edges.some((e) => e.voucher);
  const showNote = edges.some((e) => e.note);
  const subject = kind === "user" ? "Project" : "User";

  return (
    <section className="card trust-table" aria-labelledby="entries-title">
      <div className="card-head">
        <h2 id="entries-title">Entries</h2>
        <div className="trust-filters">
          <div className="seg" role="group" aria-label="Filter by status">
            {(["all", "vouched", "denounced"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setLimit(PAGE); }} disabled={s !== "all" && counts[s] === 0}>
                {s === "all" ? "All" : s === "vouched" ? "Vouched" : "Denounced"} <span className="seg-count">{counts[s]}</span>
              </button>
            ))}
          </div>
          {edges.length > 8 && (
            <input
              className="trust-search"
              type="search"
              value={text}
              onChange={(e) => { setText(e.target.value); setLimit(PAGE); }}
              placeholder={kind === "user" ? "Filter projects…" : "Filter users…"}
              aria-label={kind === "user" ? "Filter projects" : "Filter users"}
            />
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted small">No entries match.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{subject}</th>
                <th scope="col">Status</th>
                {showVoucher && <th scope="col">Vouched by</th>}
                {showNote && <th scope="col">Note</th>}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((e) => (
                <tr key={`${e.project}:${e.login}`}>
                  <td>
                    {kind === "user" ? (
                      <>
                        <Link className="mono" href={`/?q=${encodeURIComponent(e.project)}`}>{e.project}</Link>
                        {e.copies?.length ? (
                          <details className="copies">
                            <summary>+{e.copies.length} {e.copies.length === 1 ? "copy" : "copies"} of this list</summary>
                            <ul>
                              {e.copies.map((c) => (
                                <li key={c}><a className="mono" href={`https://github.com/${c}`} target="_blank" rel="noreferrer">{c}</a></li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <Link className="mono" href={`/u/${encodeURIComponent(e.login)}`}>@{e.login}</Link>
                    )}
                  </td>
                  <td>
                    <Badge tone={e.status === "vouched" ? "success" : "danger"} size="sm">
                      {e.status === "vouched" ? "Vouched" : "Denounced"}
                    </Badge>
                  </td>
                  {showVoucher && (
                    <td>{e.voucher ? <Link href={`/u/${encodeURIComponent(e.voucher)}`}>@{e.voucher}</Link> : <span className="muted">unknown</span>}</td>
                  )}
                  {showNote && <td className="muted">{e.note ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > limit && (
        <div className="trust-more">
          <span className="muted small">Showing {limit} of {rows.length}</span>
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE * 4)}>Show more</Button>
        </div>
      )}
    </section>
  );
}
