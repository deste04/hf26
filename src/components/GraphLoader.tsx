"use client";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";

/** Spinner and status line shown in place of the graph until it is fully drawn. `bare` drops the card, for use over the graph itself. */
export function GraphLoader({ label, bare = false }: { label: string; bare?: boolean }) {
  return (
    <div className={bare ? "graph-loader is-bare" : "card graph-loader"} role="status" aria-live="polite">
      <span className="graph-loader-spin" aria-hidden="true" />
      <TextShimmer className="muted">{label}</TextShimmer>
    </div>
  );
}
