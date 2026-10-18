// GET /api/auth/me → the signed-in person ({ login, name, avatar }) or null, for the header.
import { getSession } from "@/server/session";

export async function GET() {
  const session = await getSession();
  // Never the token.
  return Response.json(session && { login: session.login, name: session.name, avatar: session.avatar });
}
