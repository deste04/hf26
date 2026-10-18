// POST /api/auth/logout → clears the session cookie.
import { deleteSession } from "@/server/session";

export async function POST() {
  await deleteSession();
  return new Response(null, { status: 204 });
}
