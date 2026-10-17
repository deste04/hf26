# Notes and assumptions

- **No `schema.sql` was provided**, so we wrote one (`/schema.sql`) from the brief. `src/db/schema/index.ts` mirrors it, with the same table and column names.
- **Next.js instead of TanStack Start** (the team's decision on the day). TanStack Router file routes map to the App Router (`/`, `/u/[handle]`, `/requests`, `/discover`). `createServerFn` maps to **server actions** (`"use server"` in `src/server/actions/*`). TanStack Query is still used for client loading and error states.
- **Regenerate** on a brief bypasses the cache and overwrites the `ai_briefs` row for the current `(subject, model, prompt_version)`. Bumping `PROMPT_VERSION` in `gemma.ts` creates new rows and keeps the old ones.
- **Voucher attribution:** `crawl` records provisional `vouch_events` with `voucher_id = NULL` (shown as "unknown"). `enrich` replaces them with events derived from the git history of the vouch file, where the voucher is the commit author **only when GitHub resolves it to an account**. It is never guessed.
- Timestamps are ISO-8601 text and JSON is stored as text, so the SQL ports to Postgres. `trust_edges` is a repo function (`trustRepo`), not a DB view.
- No auth: `getCurrentUser()` returns a fixed demo maintainer (TODO: GitHub OAuth).
- **ESLint removed:** `eslint-config-next` pulled in packages with high-severity `npm audit` findings. TypeScript (`tsc --noEmit`) is the static check.
- All projects and vouch lists are real (crawled). Only the vouch requests are seeded (`is_seed = 1`, "Demo request" chip), because requests are not public data; they target `Calonca/success-cli`, which the demo maintainer owns.

## Moving the model into the browser (handoff)

The model call is isolated so it can move client-side without touching prompts, validation or caching:

- `src/server/ai/tasks.ts`: model-agnostic. `prepareBrief / prepareTriage / prepareDiscover` build the input + prompt + zod schema; `complete()` does JSON.parse → zod → drops any URL not present in the input → caches in `ai_briefs` keyed by `(subject_type, subject_key, model, prompt_version)`.
- `src/server/ai/groqRunner.ts`: the **only** model-provider code (`generate(system, prompt, jsonSchema)`, Groq's OpenAI-compatible API). Delete it, and `runOnServer` / `getBrief|getTriage|getMatches`, once the browser path is wired.
- Browser flow (server actions in `src/server/actions/ai.ts`):
  1. `prepareAi(task, model, force?)` → `{ cached }` (show it) or `{ spec: { system, prompt, jsonSchema } }`
  2. run the in-browser model with `spec` (constrain to `jsonSchema` if the runtime supports it)
  3. `submitAi(task, model, rawText)` → `AiResult` (validated + grounded on the server, then cached)
  - `task` is `{kind:"brief",login}` | `{kind:"triage",requestId}` | `{kind:"discover",skills,hours}`.
  - Triage uses the requester's cached brief for the same `model` if present, so run the brief first.
- Discover pre-filters to the 25 projects with the best keyword overlap so the prompt (~7 KB) fits a small model's context.
- UI components calling the server path today: `BriefCard.tsx` (getBrief), `RequestList.tsx` (getTriage), `discover/DiscoverClient.tsx` (getMatches).

- **Shared trust index (Neon) is additive, never required.** `src/db/neon/*` reads a flat, precomputed `trust_edges` table; `src/db/client.ts` and `src/db/repo/*` are untouched and still SQLite. Every shared read is wrapped in try/catch returning empty, so an unreachable or unconfigured index degrades to local-only rendering.
- **On a merge conflict, the local edge wins** (`src/server/trust/merge.ts`). A local edge is derived from this machine's read of the real git history, including voucher attribution; a shared row is a summary, so it must never overwrite a known voucher with "unknown". Dedup is case-insensitive on `(project, login)`.
- Shared counts are reported **separately** on Explore rather than summed into the local totals, so "projects with VOUCHED.td" stays truthful about the local index.
