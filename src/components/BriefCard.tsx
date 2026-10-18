"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDashed, ListChecks, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import type { AiResult, Brief } from "@/server/ai/tasks";
import { EvidenceList } from "./EvidenceList";

/** Aborting `signal` (e.g. leaving the profile) stops generation on the server. */
async function fetchBrief(login: string, force: boolean, signal?: AbortSignal): Promise<AiResult<Brief>> {
  const res = await fetch(`/api/ai/brief?login=${encodeURIComponent(login)}${force ? "&force=1" : ""}`, { signal });
  return res.json();
}

export function BriefCard({ login }: { login: string }) {
  const qc = useQueryClient();
  const router = useRouter();
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
    onSuccess: (res) => {
      qc.setQueryData(key, res);
      // The server re-read this person's activity for the new brief; redraw the page's tables from it.
      router.refresh();
    },
  });
  const res = regen.isPending ? undefined : q.data;
  const loading = q.isLoading || regen.isPending;

  return (
    <section className="card profile-section brief-card" aria-labelledby="brief-title" aria-busy={loading}>
      <div className="brief-head">
        {/* While the model writes, a light sweeps across the title; once done, "AI" carries the accent gradient. */}
        {loading ? (
          <TextShimmer as="h2" id="brief-title" className="brief-title">
            AI is writing the brief
          </TextShimmer>
        ) : (
          <h2 id="brief-title" className="brief-title">
            <span className="brief-ai">AI</span> brief
          </h2>
        )}
        <div className="brief-actions">
          {/* While a new brief is being written the same button cancels it, through the abort controller above. */}
          <Button
            variant="secondary"
            size="sm"
            className="regen-btn"
            data-busy={regen.isPending || undefined}
            onClick={() => (regen.isPending ? regenAbort.current?.abort() : regen.mutate())}
            disabled={q.isLoading}
            title={regen.isPending ? "Stop" : "Re-read public activity from GitHub and write a new brief"}
          >
            <RotateCw className="regen-icon" size={15} aria-hidden="true" />
            <span>{regen.isPending ? "Cancel" : "Regenerate"}</span>
          </Button>
        </div>
      </div>

      {loading && (
        <Skeleton label="Reading public activity and writing the brief" lines={4} />
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
          <div className="brief-lead">
            <p className="brief-summary">{res.data.summary}</p>
            {res.data.areas.length > 0 && (
              <div className="brief-areas" aria-label="Areas">
                {res.data.areas.map((a) => (
                  <Badge key={a} tone="neutral" size="sm">
                    {a}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {res.data.vouch_lists && (
            // Built from the vouch lists, not by the model: it says so, since the card around it is the AI's.
            <p className={`brief-vouch${/denounc/i.test(res.data.vouch_lists) ? " is-warn" : ""}`}>
              <ListChecks className="brief-vouch-icon" size={16} aria-hidden="true" />
              <span>
                {res.data.vouch_lists} <span className="brief-source">From VOUCHED.td files, not written by AI.</span>
              </span>
            </p>
          )}
          <div className="brief-body">
            <div className="brief-block">
              <h3>
                Evidence <span className="brief-count">{res.data.strengths.length}</span>
              </h3>
              <EvidenceList items={res.data.strengths} />
            </div>
            {res.data.gaps.length > 0 && (
              <div className="brief-block brief-gaps-block">
                <h3>Not in the data</h3>
                <ul className="brief-gaps">
                  {res.data.gaps.map((g, i) => (
                    <li key={i}>
                      <CircleDashed size={14} aria-hidden="true" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
