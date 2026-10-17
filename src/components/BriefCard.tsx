"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import type { AiResult, Brief } from "@/server/ai/tasks";
import { EvidenceList } from "./EvidenceList";

/** Aborting `signal` (e.g. leaving the profile) stops generation on the server. */
async function fetchBrief(login: string, force: boolean, signal?: AbortSignal): Promise<AiResult<Brief>> {
  const res = await fetch(`/api/ai/brief?login=${encodeURIComponent(login)}${force ? "&force=1" : ""}`, { signal });
  return res.json();
}

export function BriefCard({ login }: { login: string }) {
  const qc = useQueryClient();
  const key = ["brief", login.toLowerCase()];
  // TanStack Query aborts `signal` when the last observer unmounts, i.e. when the profile closes.
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchBrief(login, false, signal), staleTime: Infinity });
  const regenAbort = useRef<AbortController | null>(null);
  useEffect(() => () => regenAbort.current?.abort(), []);
  const regen = useMutation({
    mutationFn: () => {
      regenAbort.current?.abort();
      regenAbort.current = new AbortController();
      return fetchBrief(login, true, regenAbort.current.signal);
    },
    onSuccess: (res) => qc.setQueryData(key, res),
  });
  const res = regen.isPending ? undefined : q.data;
  const loading = q.isLoading || regen.isPending;

  return (
    <section className="card profile-section brief-card" aria-labelledby="brief-title" aria-busy={loading}>
      <div className="brief-head">
        <h2 id="brief-title">Contribution brief</h2>
        <div className="brief-actions">
          <Button variant="ghost" size="sm" onClick={() => regen.mutate()} disabled={loading} loading={regen.isPending}>
            Regenerate
          </Button>
        </div>
      </div>

      {loading && (
        <div className="stack">
          <Skeleton label="AI is writing the brief" lines={3} />
          <p className="muted small">Reading public activity…</p>
        </div>
      )}
      {!loading && q.error && (
        <Alert tone="danger" title="Could not load brief" role="alert">
          {String(q.error)}
        </Alert>
      )}
      {!loading && res && !res.ok && (
        <Alert
          tone={res.error.code === "cancelled" ? "info" : "warning"}
          role="alert"
          title={
            res.error.code === "model_unavailable"
              ? "Model unavailable"
              : res.error.code === "not_found"
                ? "Not found"
                : res.error.code === "cancelled"
                  ? "Cancelled"
                  : "Invalid model output"
          }
        >
          {res.error.message}
        </Alert>
      )}
      {!loading && res && res.ok && (
        <>
          <p className="brief-summary">{res.data.summary}</p>
          {res.data.vouch_lists && (
            <div className={`brief-block brief-vouch${/denounc/i.test(res.data.vouch_lists) ? " is-warn" : ""}`}>
              <h3>What maintainers&apos; vouch lists say</h3>
              <p>{res.data.vouch_lists}</p>
            </div>
          )}
          <div className="brief-block">
            <h3>Evidence</h3>
            <EvidenceList items={res.data.strengths} />
          </div>
          {res.data.gaps.length > 0 && (
            <div className="brief-block">
              <h3>What the data does not show</h3>
              <ul className="brief-gaps">
                {res.data.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {res.data.areas.length > 0 && (
            <div className="brief-areas" aria-label="Areas">
              {res.data.areas.map((a) => (
                <Badge key={a} tone="neutral" size="sm">
                  {a}
                </Badge>
              ))}
            </div>
          )}
          <p className="muted small">
            <span className="mono">{res.model}</span> · {res.cached ? "cached" : "generated"}{" "}
            {new Date(res.created_at).toLocaleString()}
          </p>
        </>
      )}

      <p className="brief-footer">
        This brief explains public activity. It is not a score and never vouches or denounces anyone — maintainers decide.
      </p>
    </section>
  );
}
