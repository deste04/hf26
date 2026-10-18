// GET /api/trust?q=<handle|owner/repo>[&part=list|vouchers|activity] → trust edges read live from GitHub.
// Read-only, fixed response shape, whitelisted parameters: no caller-chosen
// columns, filters or SQL. The fixed shape is what makes this safe.
// Without `part` everything comes in one response; with it, the Explore page fetches the quick list first
// and the slow parts (vouchers from blame, activity) separately. Each part re-reads the list from the cache.
import { activityOnly, exploreSearch, vouchersFor } from "@/server/actions/explore";
import { cleanQuery } from "@/lib/query";

const MAX_Q = 120;
const VALID_Q = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
const PARTS = new Set(["list", "vouchers", "activity"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = cleanQuery(params.get("q") ?? "");
  const part = params.get("part");
  if (!raw || raw.length > MAX_Q || !VALID_Q.test(raw) || (part !== null && !PARTS.has(part))) {
    return Response.json(
      { error: "Pass ?q= a GitHub handle or owner/repo, and optionally &part=list|vouchers|activity." },
      { status: 400 },
    );
  }
  const result = await exploreSearch(raw);
  const { kind, q, edges: listed, issue } = result;
  if (part === "list") return Response.json(result);
  if (part === "vouchers") return Response.json(kind === "user" && listed.length > 0 ? await vouchersFor(q, listed) : listed);
  if (part === "activity") return Response.json(kind === "user" && !issue ? await activityOnly(q, listed) : []);
  const [edges, activity] = kind === "user" ? await Promise.all([vouchersFor(q, listed), activityOnly(q, listed)]) : [listed, []];
  return Response.json({ kind, q, count: edges.length, issue, edges, activity });
}
