"use client";
import { use, useEffect, useState, type ReactNode } from "react";
import TrustGraph from "@/components/TrustGraph";
import { TrustTable } from "@/components/TrustTable";
import type { TrustEdge } from "@/server/trust/types";

type Center = { kind: "user" | "project"; id: string };

/** Resolves a promise sent by a Server Component into state; null until then. */
function useLater<T>(promise: Promise<T> | null): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    // A new promise means new data on the way: never keep showing the previous one meanwhile.
    setValue(null);
    if (!promise) return;
    let live = true;
    // A promise from a Server Component arrives as React's thenable, whose then() returns nothing: adopt it first.
    Promise.resolve(promise)
      .then((v) => live && setValue(v))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [promise]);
  return value;
}

/**
 * Graph and table drawn from the entries known now; vouchers (slow: one blame per list) and the person's
 * activity-only repos arrive as promises and are swapped in when they resolve, without holding the page.
 */
export function ResultView({
  header,
  center,
  edges,
  vouchers,
  activity,
}: {
  /** The card's header, rendered on the server. */
  header: ReactNode;
  center: Center;
  edges: TrustEdge[];
  vouchers: Promise<TrustEdge[]> | null;
  activity: Promise<string[]>;
}) {
  const attributed = useLater(vouchers);
  const repos = useLater(activity) ?? [];
  const shown = attributed ?? edges;
  const pending = !!vouchers && !attributed;
  return (
    <>
      <div className="card">
        {header}
        <TrustGraph center={center} edges={shown} activity={repos} vouchersPending={pending} />
      </div>
      {shown.length > 0 && <TrustTable kind={center.kind} edges={shown} vouchersPending={pending} />}
    </>
  );
}

/** "· N other repos with activity", once the activity read resolves. Render inside Suspense. */
export function ActivityCount({ activity }: { activity: Promise<string[]> }) {
  const n = use(activity).length;
  return n > 0 ? <> · {n.toLocaleString("en-US")} other repo{n === 1 ? "" : "s"} with activity</> : null;
}
