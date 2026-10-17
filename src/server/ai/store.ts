// Model outputs kept in server memory, keyed like the old ai_briefs table. Lost on restart; nothing to set up.
// Not Next's "use cache": that would also keep failed generations, and it can't carry the AbortSignal the AI queue cancels with.
export type BriefKey = { subject_type: string; subject_key: string; model: string; prompt_version: string };
type Entry = { output_json: string; created_at: string };

const MAX = 500;
// Survives Next.js hot reloads in dev.
const g = globalThis as unknown as { __vouchAiStore?: Map<string, Entry> };
const store = (g.__vouchAiStore ??= new Map());
const keyOf = (k: BriefKey) => [k.subject_type, k.subject_key, k.model, k.prompt_version].join("\u0000");

export const briefStore = {
  get(k: BriefKey): Entry | undefined {
    return store.get(keyOf(k));
  },
  put(k: BriefKey, output: unknown): Entry {
    const entry = { output_json: JSON.stringify(output), created_at: new Date().toISOString() };
    const key = keyOf(k);
    store.delete(key); // re-insert so the oldest entry is evicted first
    store.set(key, entry);
    if (store.size > MAX) store.delete(store.keys().next().value!);
    return entry;
  },
};
