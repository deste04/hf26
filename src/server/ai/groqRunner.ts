// The ONLY model-provider code: Groq's OpenAI-compatible chat API. Replace or delete when the model runs in the browser:
// the browser then calls prepareAi() → runs the model → submitAi() (src/server/actions/ai.ts).

export const SERVER_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const BASE_URL = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";

/**
 * Returns the raw model text (expected to be JSON matching jsonSchema). Throws if the key is missing or Groq fails.
 * Aborting `signal` cancels the request.
 */
export async function generate(system: string, prompt: string, jsonSchema: object, signal?: AbortSignal): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    signal,
    body: JSON.stringify({
      model: SERVER_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      // strict: false — zod's schemas don't meet strict mode's rules (every property required, no extra keywords);
      // the output is validated with zod afterwards anyway.
      response_format: { type: "json_schema", json_schema: { name: "result", schema: jsonSchema, strict: false } },
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}
