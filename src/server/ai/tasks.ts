// AI tasks, independent of where the model runs. Each task is split in two server-side halves:
//   prepare → input from GitHub (cached) + system prompt + user prompt + JSON schema
//   complete → JSON.parse + zod + drop URLs not in the input + keep in the in-memory store
// The model call in between happens either on the server (groqRunner.ts) or in the
// browser (prepareAi/submitAi actions). The AI explains, humans decide: no scores.
import { z } from "zod";
import { userContributions, type Contribution } from "../github";
import { userEdges } from "../vouch";
import { generate, SERVER_MODEL } from "./groqRunner";
import { enqueue } from "./queue";
import { briefStore } from "./store";

export const PROMPT_VERSIONS = {
  brief: "brief-v5",
} as const;

export const RULES =
  "Use only the data provided. If evidence is missing, say so. Do not rate or score the person. Do not recommend vouching or denouncing.";

export type AiError = { code: "model_unavailable" | "invalid_output" | "not_found" | "cancelled"; message: string };
export type AiResult<T> =
  | { ok: true; data: T; cached: boolean; created_at: string; model: string }
  | { ok: false; error: AiError };

export type Prepared<Out> = {
  subjectType: string;
  subjectKey: string;
  promptVersion: string;
  input: unknown;
  schema: z.ZodType;
  system: string; // includes RULES
  prompt: string;
  postprocess: (raw: never) => Out;
};

/** What the browser needs to run the model itself. */
export type PromptSpec = { system: string; prompt: string; jsonSchema: object };
export const toSpec = (p: Prepared<unknown>): PromptSpec => ({
  system: p.system,
  prompt: p.prompt,
  jsonSchema: z.toJSONSchema(p.schema) as object,
});

const keyOf = (p: Prepared<unknown>, model: string) => ({
  subject_type: p.subjectType,
  subject_key: p.subjectKey,
  model,
  prompt_version: p.promptVersion,
});

/** Cached result for this model, if any. */
export function cachedResult<Out>(p: Prepared<Out>, model: string): AiResult<Out> | undefined {
  const hit = briefStore.get(keyOf(p, model));
  if (!hit) return undefined;
  return { ok: true, data: JSON.parse(hit.output_json) as Out, cached: true, created_at: hit.created_at, model };
}

/** Validate raw model text, keep only grounded URLs, store. */
export function complete<Out>(p: Prepared<Out>, raw: string, model: string): AiResult<Out> {
  let json: unknown;
  try {
    // Tolerate JSON wrapped in a ```json fence or surrounded by a stray line.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    json = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
  } catch {
    return { ok: false, error: { code: "invalid_output", message: "Model output was not valid JSON." } };
  }
  const parsed = p.schema.safeParse(json);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "invalid_output", message: `Model output failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}` },
    };
  const data = p.postprocess(parsed.data as never);
  const row = briefStore.put(keyOf(p, model), data);
  return { ok: true, data, cached: false, created_at: row.created_at, model };
}

const jobLabel = (p: Prepared<unknown>) => `Brief @${p.subjectKey}`;

/** Cache → server model (retry once on invalid output). */
export async function runOnServer<Out>(p: Prepared<Out>, force = false, signal?: AbortSignal): Promise<AiResult<Out>> {
  if (!force) {
    const hit = cachedResult(p, SERVER_MODEL);
    if (hit) return hit;
  }
  const spec = toSpec(p);
  let last: AiResult<Out> = { ok: false, error: { code: "invalid_output", message: "Model returned no usable output." } };
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await enqueue(jobLabel(p), (s) => generate(spec.system, spec.prompt, spec.jsonSchema, s), signal);
    } catch (err) {
      if ((err as Error).name === "AbortError" || signal?.aborted)
        return { ok: false, error: { code: "cancelled", message: "Cancelled (page closed or cancelled from the AI queue)." } };
      return {
        ok: false,
        error: { code: "model_unavailable", message: `Could not reach ${SERVER_MODEL} (${(err as Error).message}). No cached result yet.` },
      };
    }
    last = complete(p, raw, SERVER_MODEL);
    if (last.ok) return last;
  }
  return last;
}

const sys = (task: string) => `${task}\n\n${RULES}\nRespond with JSON only.`;

async function safeContributions(login: string): Promise<Contribution[]> {
  try {
    return (await userContributions(login)).slice(0, 30);
  } catch {
    return [];
  }
}

// ---------- 1. Contribution brief ----------

// The model cites short ids ("c3") rather than copying URLs, which small models garble;
// postprocess maps ids back to the real URLs, so every evidence link is grounded by construction.
const BriefSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.object({ text: z.string(), evidence_id: z.string() })).max(4),
  gaps: z.array(z.string()).max(4),
  areas: z.array(z.string()).max(8),
});
/** vouch_lists is computed from the vouch data, not written by the model: small models drop denouncements. */
export type Brief = {
  summary: string;
  vouch_lists: string;
  strengths: { text: string; evidence_url: string }[];
  gaps: string[];
  areas: string[];
};

function describeVouchLists(s: { vouched_in: number; denounced_in: number; denounce_notes: (string | null)[] } | null) {
  if (!s) return ""; // unknown (no token or search failed): the card hides the box rather than guess
  const projects = (n: number) => `${n} project${n === 1 ? "" : "s"}`;
  if (s.vouched_in === 0 && s.denounced_in === 0) return "Not listed in any VOUCHED.td GitHub search found.";
  const parts: string[] = [];
  if (s.denounced_in > 0) {
    const notes = s.denounce_notes.length ? ` with the note${s.denounce_notes.length > 1 ? "s" : ""} ${s.denounce_notes.map((n) => `“${n}”`).join(", ")}` : "";
    parts.push(`Denounced in ${projects(s.denounced_in)}${notes}.`);
  }
  if (s.vouched_in > 0) parts.push(`Vouched in ${projects(s.vouched_in)}.`);
  return parts.join(" ");
}

export async function prepareBrief(login: string): Promise<Prepared<Brief>> {
  const [contributions, trust] = await Promise.all([safeContributions(login), userEdges(login)]);
  const checked = trust.status === "ok";
  const vouches = (checked ? trust.edges : []).map((e) => ({
    project: e.project,
    status: e.status,
    voucher: e.voucher ?? "unknown",
    note: e.note,
  }));
  // Pre-digested so a small model can't miss it: counts plus maintainers' own notes, verbatim.
  const denounced = vouches.filter((v) => v.status === "denounced");
  const vouch_summary = checked
    ? {
        vouched_in: vouches.filter((v) => v.status === "vouched").length,
        denounced_in: denounced.length,
        denounce_notes: [...new Set(denounced.map((d) => d.note).filter(Boolean))],
        denounced_by_projects: denounced.map((d) => d.project).slice(0, 10),
      }
    : null; // unknown, which the model must not read as "not listed"
  const input = {
    login,
    vouch_summary,
    contributions: contributions.map(({ title, repo, kind, state }, i) => ({ id: `c${i + 1}`, title, repo, kind, state })),
    vouch_entries: vouches,
  };
  const urlOf = new Map(contributions.map((c, i) => [`c${i + 1}`, c.url]));
  return {
    subjectType: "user",
    subjectKey: login.toLowerCase(),
    promptVersion: PROMPT_VERSIONS.brief,
    input,
    schema: BriefSchema,
    system: sys(
      "You write short, factual contribution briefs about open-source contributors for maintainers. " +
      "summary: 2-3 sentences describing what the person works on. " +
      "If vouch_summary is null, do not mention vouch lists. If vouch_summary.denounced_in > 0, the summary must state that maintainers denounced them and quote the notes, without adding judgement. strengths: up to 4 items, each citing the id of one input contribution as evidence_id (e.g. \"c1\"). " +
      "gaps: what the data does not show (e.g. no reviews, no merged PRs). areas: short lowercase topic tags like docs, cli, tests.",
    ),
    prompt: `Data for GitHub user ${login}:\n${JSON.stringify(input)}`,
    postprocess: (b: z.infer<typeof BriefSchema>): Brief => ({
      ...b,
      vouch_lists: describeVouchLists(vouch_summary),
      strengths: b.strengths.flatMap((s) => {
        const url = urlOf.get(s.evidence_id.trim().toLowerCase());
        return url ? [{ text: s.text, evidence_url: url }] : [];
      }),
      areas: [...new Set(b.areas.map((a) => a.toLowerCase()))],
    }),
  };
}

export const contributionBrief = async (login: string, force = false, signal?: AbortSignal) =>
  runOnServer(await prepareBrief(login), force, signal);
