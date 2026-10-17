// Brief generation as a route handler (not a server action) so it can be cancelled:
// when the browser aborts the fetch (profile closed), request.signal aborts the model call.
import { contributionBrief } from "@/server/ai/tasks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const login = url.searchParams.get("login");
  if (!login) return Response.json({ ok: false, error: { code: "not_found", message: "Missing login." } }, { status: 400 });
  const result = await contributionBrief(login, url.searchParams.get("force") === "1", request.signal);
  return Response.json(result);
}
