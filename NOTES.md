# Notes and assumptions

- **Next.js instead of TanStack Start** (the team's decision on the day). TanStack Router file routes map to the App Router (`/`, `/u/[handle]`). `createServerFn` maps to **server actions** (`"use server"` in `src/server/actions/*`). TanStack Query is still used for client loading and error states.
- **No database.** Trust data is read live from GitHub (`src/server/vouch.ts`) and cached with Next's `"use cache"` (Cache Components, `next.config.ts`). Pages that read the URL do so inside `<Suspense>`; the profile calls `connection()` because it is per-person live data.
- **Regenerate** on a brief bypasses the in-memory store (`src/server/ai/store.ts`) and overwrites the entry for the current `(subject, model, prompt_version)`. Bumping `PROMPT_VERSIONS.brief` in `tasks.ts` starts fresh entries.
- **Voucher attribution:** each line of a project's `VOUCHED.td` is attributed to the commit that last added or flipped it, within the file's last 30 commits. The voucher is the commit author **only when GitHub resolves it to an account**. Lines older than that window, or a rate-limited history, stay "unknown". It is never guessed.
- **Person search needs `GITHUB_TOKEN`**: GitHub code search refuses anonymous calls. Without a token the UI stays quiet (no vouch section, no "not listed" claim) and the server logs one warning.
- **ESLint removed:** `eslint-config-next` pulled in packages with high-severity `npm audit` findings. TypeScript (`tsc --noEmit`) is the static check.

## Moving the model into the browser (handoff)

The model call is isolated so it can move client-side without touching prompts, validation or caching:

- `src/server/ai/tasks.ts`: model-agnostic. `prepareBrief` builds the input + prompt + zod schema; `complete()` does JSON.parse → zod → drops any URL not present in the input → keeps the result in `briefStore`, keyed by `(subject_type, subject_key, model, prompt_version)`.
- `src/server/ai/groqRunner.ts`: the **only** model-provider code (`generate(system, prompt, jsonSchema)`, Groq's OpenAI-compatible API). Delete it, and `runOnServer` / `getBrief`, once the browser path is wired.
- Browser flow (server actions in `src/server/actions/ai.ts`):
  1. `prepareAi(task, model, force?)` → `{ cached }` (show it) or `{ spec: { system, prompt, jsonSchema } }`
  2. run the in-browser model with `spec` (constrain to `jsonSchema` if the runtime supports it)
  3. `submitAi(task, model, rawText)` → `AiResult` (validated + grounded on the server, then stored)
  - `task` is `{kind:"brief",login}`.
- UI calling the server path today: `BriefCard.tsx` (via `/api/ai/brief`).
