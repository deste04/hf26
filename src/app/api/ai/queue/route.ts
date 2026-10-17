import { connection } from "next/server";
import { cancelJob, listJobs } from "@/server/ai/queue";

/** The queue changes every second: connection() keeps this from being prerendered. */
export async function GET() {
  await connection();
  return Response.json(listJobs());
}

/** DELETE /api/ai/queue?id=3 cancels a queued or running job. */
export function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  return Response.json({ cancelled: cancelJob(id) });
}
