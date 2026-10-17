// In-memory FIFO for model calls: one request at a time keeps us inside Groq's rate limits, and queueing here
// lets the UI show what is waiting and cancel any job (queued or running).
export type JobState = "queued" | "running";
export type JobView = { id: number; label: string; state: JobState; position: number; createdAt: string; startedAt: string | null };

type Job = {
  id: number;
  label: string;
  state: JobState;
  createdAt: string;
  startedAt: string | null;
  controller: AbortController;
  start: () => void;
};

type Queue = { nextId: number; jobs: Job[] };
// Survive Next.js hot reloads in dev.
const g = globalThis as unknown as { __aiQueue?: Queue };
const q: Queue = (g.__aiQueue ??= { nextId: 1, jobs: [] });

function pump() {
  if (q.jobs.some((j) => j.state === "running")) return;
  const next = q.jobs.find((j) => j.state === "queued");
  if (!next) return;
  next.state = "running";
  next.startedAt = new Date().toISOString();
  next.start();
}

/** Run `fn` when it reaches the front of the queue. Rejects with AbortError if cancelled. */
export function enqueue<T>(label: string, fn: (signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  external?.throwIfAborted();
  external?.addEventListener("abort", () => controller.abort(), { once: true });
  return new Promise<T>((resolve, reject) => {
    const job: Job = {
      id: q.nextId++,
      label,
      state: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      controller,
      start: () => fn(controller.signal).then(resolve, reject).finally(done),
    };
    const done = () => {
      q.jobs = q.jobs.filter((j) => j !== job);
      pump();
    };
    controller.signal.addEventListener(
      "abort",
      () => {
        if (job.state !== "queued") return; // a running job rejects through fn's own signal
        done();
        reject(new DOMException("Cancelled", "AbortError"));
      },
      { once: true },
    );
    q.jobs.push(job);
    pump();
  });
}

export function listJobs(): JobView[] {
  let pos = 0;
  return q.jobs.map(({ id, label, state, createdAt, startedAt }) => ({
    id,
    label,
    state,
    position: state === "queued" ? ++pos : 0,
    createdAt,
    startedAt,
  }));
}

export function cancelJob(id: number): boolean {
  const job = q.jobs.find((j) => j.id === id);
  if (!job) return false;
  job.controller.abort();
  return true;
}
