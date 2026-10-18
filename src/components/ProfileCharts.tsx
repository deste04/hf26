"use client";
import { DonutChart } from "@/components/arc/donut-chart/donut-chart";
import { Sparkline } from "@/components/arc/sparkline/sparkline";

export type WeekTotal = { week: string; count: number };
export type ContributionMix = { commits: number; prs: number; issues: number; reviews: number };

const fmt = (n: number) => n.toLocaleString("en-US");
const weekLabel = (iso: string) =>
  `Week of ${new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;

/**
 * Two tiles for the profile: contributions per full week from the calendar above, and the mix of commits, PRs,
 * issues and reviews across every repo in the table below. Each names its period, since the two differ.
 * Either is left out without data.
 */
export function ProfileCharts({ weeks, mix, mixPeriod }: { weeks: WeekTotal[]; mix: ContributionMix | null; mixPeriod: string }) {
  const counts = weeks.map((w) => w.count);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const slices = mix
    ? [
        { key: "commits", label: "Commits", value: mix.commits },
        { key: "prs", label: "Pull requests", value: mix.prs },
        { key: "issues", label: "Issues", value: mix.issues },
        { key: "reviews", label: "Reviews", value: mix.reviews },
      ].filter((s) => s.value > 0)
    : [];
  return (
    <div className="profile-charts">
      {weeks.length > 1 && (
        <div className="profile-chart">
          <div className="profile-chart-head">
            <h3>Weekly trend</h3>
            <p className="muted small">{fmt(weeks.length)} full weeks, from the calendar above</p>
          </div>
          <Sparkline
            data={counts}
            labels={weeks.map((w) => weekLabel(w.week))}
            label="Contributions"
            value={fmt(total)}
            change={`peak ${fmt(Math.max(...counts))} a week`}
            formatValue={(v) => fmt(v)}
            width={720}
            height={120}
          />
        </div>
      )}
      {slices.length > 0 && (
        <div className="profile-chart">
          <div className="profile-chart-head">
            <h3>Contribution mix</h3>
            <p className="muted small">{mixPeriod}</p>
          </div>
          {/* Every kind keeps its own segment: with four of them, grouping the small ones into "Other" hides two. */}
          <DonutChart data={slices} label="Contribution mix" totalLabel="Contributions" size={168} thickness={20} groupBelow={0} className="profile-donut" />
        </div>
      )}
    </div>
  );
}
