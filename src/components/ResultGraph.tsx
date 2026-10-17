"use client";
import { use, useEffect, useState } from "react";
import TrustGraph from "@/components/TrustGraph";
import type { TrustEdge } from "@/server/trust/types";

type Center = { kind: "user" | "project"; id: string };

/**
 * The trust graph drawn as soon as the vouch entries exist; the person's activity-only repos (a slower read) arrive
 * as a promise from the server and are added to the graph when it resolves, without holding the page.
 */
export function ResultGraph({ center, edges, activity }: { center: Center; edges: TrustEdge[]; activity: Promise<string[]> }) {
  const [repos, setRepos] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    // A promise passed from a Server Component arrives as React's thenable, whose then() returns nothing: adopt it into
    // a real Promise before chaining.
    Promise.resolve(activity)
      .then((a) => live && setRepos(a))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [activity]);
  return <TrustGraph center={center} edges={edges} activity={repos} />;
}

/** "· N other repos with activity", once the activity read resolves. Render inside Suspense. */
export function ActivityCount({ activity }: { activity: Promise<string[]> }) {
  const n = use(activity).length;
  return n > 0 ? <> · {n.toLocaleString("en-US")} other repo{n === 1 ? "" : "s"} with activity</> : null;
}
