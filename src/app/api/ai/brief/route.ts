// Brief generation as a route handler (not a server action) so it can be cancelled:
// when the browser aborts the fetch (profile closed), request.signal aborts the model call.
import { revalidateTag } from "next/cache";
import { contributionBrief } from "@/server/ai/tasks";
import { personTag } from "@/server/github";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const login = url.searchParams.get("login");
  if (!login) return Response.json({ ok: false, error: { code: "not_found", message: "Missing login." } }, { status: 400 });
  const force = url.searchParams.get("force") === "1";
  // Regenerate re-reads the person's GitHub activity too: expire: 0 makes the next read a real fetch, not stale data,
  // so the new brief and the page refreshed after it both see the latest contributions and vouch lists.
  if (force) revalidateTag(personTag(login), { expire: 0 });
  const result = await contributionBrief(login, force, request.signal);
  return Response.json(result);
}
