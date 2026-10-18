"use server";
import { SERVER_MODEL } from "../ai/groqRunner";
import {
  cachedResult,
  complete,
  contributionBrief,
  prepareBrief,
  toSpec,
  type AiResult,
  type Prepared,
  type PromptSpec,
} from "../ai/tasks";
import { readAsViewer } from "../session";

const SIGNED_OUT = { ok: false, error: { code: "signed_out", message: "Sign in with GitHub to read the AI brief." } } as const;

// --- Server-side model (Groq today) ---

export async function getBrief(login: string, force = false) {
  if (!(await readAsViewer())) return SIGNED_OUT;
  return contributionBrief(login, force);
}

// --- Browser-side model: prepareAi → run model in the browser → submitAi ---

export type AiTask = { kind: "brief"; login: string };

async function prepare(task: AiTask): Promise<Prepared<unknown> | null> {
  return prepareBrief(task.login);
}

/** Returns the cached result for `model`, or the prompt + JSON schema for the browser to run. */
export async function prepareAi(
  task: AiTask,
  model: string,
  force = false,
): Promise<{ cached: AiResult<unknown> } | { spec: PromptSpec } | { error: string }> {
  if (!(await readAsViewer())) return { error: SIGNED_OUT.error.message };
  const p = await prepare(task);
  if (!p) return { error: "Not found." };
  const hit = force ? undefined : cachedResult(p, model);
  return hit ? { cached: hit } : { spec: toSpec(p) };
}

/** Validates the browser's raw model output on the server (zod + grounded URLs) and caches it. */
export async function submitAi(task: AiTask, model: string, raw: string): Promise<AiResult<unknown>> {
  if (!(await readAsViewer())) return SIGNED_OUT;
  const p = await prepare(task);
  if (!p) return { ok: false, error: { code: "not_found", message: "Not found." } };
  return complete(p, raw, model);
}

export async function serverModel() {
  return SERVER_MODEL;
}
