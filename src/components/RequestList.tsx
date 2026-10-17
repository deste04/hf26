"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTriage } from "@/server/actions/ai";
import { Alert } from "@/components/arc/alert/alert";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Textarea } from "@/components/arc/textarea/textarea";
import { decideRequest } from "@/server/actions/pages";
import type { VouchRequest, Decision } from "@/db/repo";
import { SampleChip } from "./SampleChip";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  vouched: "Vouched",
  more_info: "Asked for more info",
  denounced: "Denounced",
};
const statusTone = (s: string): BadgeTone => (s === "vouched" ? "success" : s === "denounced" ? "danger" : "neutral");
const firstLine = (m: string) => {
  const line = m.split(/\r?\n|(?<=[.!?])\s/)[0];
  return line.length > 70 ? `${line.slice(0, 68)}…` : line;
};

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="req-icon-ok" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="req-icon-warn" aria-hidden="true">
      <path d="M12 8v5M12 17h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function RequestList({ initial, project, isSeed }: { initial: VouchRequest[]; project: string; isSeed: boolean }) {
  const [requests, setRequests] = useState(initial);
  const [selectedId, setSelectedId] = useState<number | null>(
    initial.find((r) => r.status === "open")?.id ?? initial[0]?.id ?? null,
  );
  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const open = requests.filter((r) => r.status === "open");
  const decided = requests.filter((r) => r.status !== "open");

  if (requests.length === 0) return <p className="muted">No vouch requests for this project.</p>;

  const item = (r: VouchRequest) => (
    <li key={r.id}>
      <button
        type="button"
        className={`req-item${r.id === selectedId ? " is-selected" : ""}`}
        aria-pressed={r.id === selectedId}
        onClick={() => setSelectedId(r.id)}
      >
        <span className="req-item-top">
          <strong>@{r.requester_login}</strong>
          {r.status !== "open" && (
            <Badge tone={statusTone(r.status)} size="sm">
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
          )}
        </span>
        <span className="muted small">{firstLine(r.message)}</span>
      </button>
    </li>
  );

  return (
    <div className="req-layout">
      <section className="card req-list" aria-label="Vouch requests">
        <h2 className="req-list-heading">Open · {open.length}</h2>
        {open.length === 0 ? <p className="muted small req-empty">Nothing open.</p> : <ul>{open.map(item)}</ul>}
        {decided.length > 0 && (
          <>
            <h2 className="req-list-heading">Decided · {decided.length}</h2>
            <ul>{decided.map(item)}</ul>
          </>
        )}
      </section>
      {selected && (
        <RequestDetail
          key={selected.id}
          request={selected}
          project={project}
          isSeed={isSeed}
          onDecided={(u) => setRequests((rs) => rs.map((r) => (r.id === u.id ? u : r)))}
        />
      )}
    </div>
  );
}

function RequestDetail({
  request,
  project,
  isSeed,
  onDecided,
}: {
  request: VouchRequest;
  project: string;
  isSeed: boolean;
  onDecided: (r: VouchRequest) => void;
}) {
  const qc = useQueryClient();
  const key = ["triage", request.id];
  const triage = useQuery({ queryKey: key, queryFn: () => getTriage(request.id, false), staleTime: Infinity });
  const regen = useMutation({ mutationFn: () => getTriage(request.id, true), onSuccess: (r) => qc.setQueryData(key, r) });
  const [reply, setReply] = useState<string>(request.reply_text ?? "");
  const [confirmDenounce, setConfirmDenounce] = useState(false);
  const res = regen.isPending ? undefined : triage.data;
  const loading = triage.isLoading || regen.isPending;

  useEffect(() => {
    if (!request.reply_text && res?.ok) setReply((cur) => cur || res.data.draft_reply);
  }, [res, request.reply_text]);

  const decide = useMutation({
    mutationFn: (d: Decision) => decideRequest(request.id, d, reply || null),
    onSuccess: (u) => {
      setConfirmDenounce(false);
      if (u) onDecided(u);
    },
  });

  return (
    <section className="card req-detail" aria-labelledby={`req-${request.id}`}>
      <div className="req-detail-head">
        <h2 id={`req-${request.id}`}>
          <Link href={`/u/${request.requester_login}`}>@{request.requester_login}</Link> wants to contribute
        </h2>
        <SampleChip show={isSeed} label="Demo request" />
      </div>
      <blockquote className="req-message">“{request.message}”</blockquote>
      <p className="muted small">
        To <span className="mono">{project}</span> · requested {new Date(request.created_at).toLocaleString()}
      </p>

      <div className="req-brief">
        <div className="req-brief-head">
          <h3>AI brief</h3>
          <Badge tone="info" size="sm">public data · local model</Badge>
          <Button variant="ghost" size="sm" onClick={() => regen.mutate()} disabled={loading} loading={regen.isPending}>
            Re-check
          </Button>
        </div>
        {loading && (
          <div className="req-checks" aria-busy="true" aria-label="AI is checking the request">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="req-check">
                <Skeleton label="AI is checking the request" lines={1} />
              </div>
            ))}
          </div>
        )}
        {!loading && res && !res.ok && (
          <Alert
            tone="warning"
            role="alert"
            title={res.error.code === "model_unavailable" ? "Model unavailable" : "Could not read the model output"}
          >
            {res.error.message} You can still decide below.
          </Alert>
        )}
        {!loading && res?.ok && (
          <ul className="req-checks">
            {res.data.checks.map((c, i) => (
              <li key={i} className={`req-check${c.ok ? "" : " is-warn"}`}>
                {c.ok ? <CheckIcon /> : <WarnIcon />}
                <span>
                  <span className="sr-only">{c.ok ? "Yes: " : "Needs attention: "}</span>
                  {c.label}
                  {c.evidence_url && (
                    <>
                      {" "}
                      <a href={c.evidence_url} target="_blank" rel="noreferrer" className="small">
                        evidence ↗
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Textarea id={`reply-${request.id}`} label="Draft reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />

      {request.status !== "open" && (
        <p className="req-decided">
          <Badge tone={statusTone(request.status)} size="sm">
            {STATUS_LABEL[request.status]}
          </Badge>{" "}
          by{" "}
          <span className="mono">{request.decided_by}</span>
          {request.decided_at && <> · {new Date(request.decided_at).toLocaleString()}</>}
        </p>
      )}

      <div className="req-actions">
        <Button disabled={decide.isPending} onClick={() => decide.mutate("vouched")}>
          Vouch
        </Button>
        <Button variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate("more_info")}>
          Ask for more info
        </Button>
        {!confirmDenounce ? (
          <Button variant="danger" disabled={decide.isPending} onClick={() => setConfirmDenounce(true)}>
            Denounce…
          </Button>
        ) : (
          <span className="req-confirm" role="group" aria-label="Confirm denounce">
            <span>Denounce @{request.requester_login}?</span>
            <Button variant="danger" onClick={() => decide.mutate("denounced")}>
              Yes, denounce
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDenounce(false)}>
              Cancel
            </Button>
          </span>
        )}
      </div>
      {decide.error && (
        <Alert tone="danger" title="Could not save the decision">
          {String(decide.error)}
        </Alert>
      )}
      <p className="muted small req-footnote">
        In production your decision would open a PR updating <span className="mono">VOUCHED.td</span> — nothing is written
        to GitHub today. The AI only summarizes; it never acts on its own.
      </p>
    </section>
  );
}
