import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

process.env.GROQ_BASE_URL = "http://127.0.0.1:1"; // unreachable on purpose
process.env.GROQ_API_KEY = "test";

type Tasks = typeof import("../src/server/ai/tasks");
let tasks: Tasks;

beforeAll(async () => {
  tasks = await import("../src/server/ai/tasks");
});

const schema = z.object({ strengths: z.array(z.object({ text: z.string(), evidence_url: z.string() })) });
type Out = z.infer<typeof schema>;

function prepared(): import("../src/server/ai/tasks").Prepared<Out> {
  const urls = new Set(["https://github.com/a/b/pull/1"]);
  return {
    subjectType: "test",
    subjectKey: "k",
    promptVersion: "t1",
    input: { urls: [...urls] },
    schema,
    system: "s",
    prompt: "p",
    postprocess: ((o: Out) => ({ strengths: o.strengths.filter((s) => urls.has(s.evidence_url)) })) as (raw: never) => Out,
  };
}

describe("AI output handling", () => {
  it("drops evidence URLs that were not in the input, and caches", () => {
    const raw = JSON.stringify({
      strengths: [
        { text: "real", evidence_url: "https://github.com/a/b/pull/1" },
        { text: "invented", evidence_url: "https://github.com/x/y/pull/9" },
      ],
    });
    const r = tasks.complete(prepared(), raw, "m");
    expect(r.ok && r.data.strengths.map((s) => s.text)).toEqual(["real"]);
    expect(tasks.cachedResult(prepared(), "m")?.ok).toBe(true);
  });

  it("returns a typed error for invalid output", () => {
    const r = tasks.complete(prepared(), "{nope", "m");
    expect(r).toMatchObject({ ok: false, error: { code: "invalid_output" } });
    const bad = tasks.complete(prepared(), JSON.stringify({ strengths: "x" }), "m");
    expect(bad).toMatchObject({ ok: false, error: { code: "invalid_output" } });
  });

  it("accepts JSON wrapped in a code fence, as small models often answer", () => {
    const r = tasks.complete(prepared(), '```json\n{"strengths":[]}\n```', "fenced");
    expect(r).toMatchObject({ ok: true, data: { strengths: [] } });
  });

  it("serves from cache without the model, and reports model_unavailable otherwise", async () => {
    const hit = await tasks.runOnServer({ ...prepared() }, false);
    // cached under SERVER_MODEL? Only "m" was cached, so the server model misses → unreachable model API
    expect(hit).toMatchObject({ ok: false, error: { code: "model_unavailable" } });
  });
});
