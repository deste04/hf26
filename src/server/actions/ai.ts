"use server";
import { SERVER_MODEL } from "../ai/groqRunner";
import {
  cachedResult,
  complete,
  contributionBrief,
  discoverMatches,
  prepareBrief,
  prepareDiscover,
  prepareTriage,
  requestTriage,
  toSpec,
  type AiResult,
  type Prepared,
  type PromptSpec,
} from "../ai/tasks";

// --- Server-side model (Groq today) ---

export async function getBrief(login: string, force = false) {
  return contributionBrief(login, force);
}

export async function getTriage(id: number, force = false) {
  return requestTriage(id, force);
}

export async function getMatches(skills: string, hours: string, force = false) {
  return discoverMatches(skills, hours, force);
}

// --- Browser-side model: prepareAi → run model in the browser → submitAi ---

export type AiTask =
  | { kind: "brief"; login: string }
  | { kind: "triage"; requestId: number }
  | { kind: "discover"; skills: string; hours: string };

async function prepare(task: AiTask, model: string): Promise<Prepared<unknown> | null> {
  switch (task.kind) {
    case "brief":
      return prepareBrief(task.login);
    case "triage":
      return prepareTriage(task.requestId, model);
    case "discover":
      return prepareDiscover(task.skills, task.hours);
  }
}

/** Returns the cached result for `model`, or the prompt + JSON schema for the browser to run. */
export async function prepareAi(
  task: AiTask,
  model: string,
  force = false,
): Promise<{ cached: AiResult<unknown> } | { spec: PromptSpec } | { error: string }> {
  const p = await prepare(task, model);
  if (!p) return { error: "Not found." };
  const hit = force ? undefined : cachedResult(p, model);
  return hit ? { cached: hit } : { spec: toSpec(p) };
}

/** Validates the browser's raw model output on the server (zod + grounded URLs) and caches it. */
export async function submitAi(task: AiTask, model: string, raw: string): Promise<AiResult<unknown>> {
  const p = await prepare(task, model);
  if (!p) return { ok: false, error: { code: "not_found", message: "Not found." } };
  return complete(p, raw, model);
}

export async function serverModel() {
  return SERVER_MODEL;
}
