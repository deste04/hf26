# Vouch Explorer

Trust graph for open-source maintainers. It reads public [Vouch](https://github.com/mitchellh/vouch) lists from GitHub, shows who is vouched for or denounced across projects, and uses AI to explain the evidence. It never gives a score.

Built for Hacktoberfest Hack Day, "Best Open-Source AI Project" challenge. **Slides:** [Vouch Explorer](https://claude.ai/artifact/7n4nuT3J1MYDY1XMUyDWPH)

## The idea

AI-generated pull requests and issues are flooding maintainers. Many projects now answer with explicit trust: with Vouch, a repo keeps a plain-text `VOUCHED.td` file listing who is vouched for and who is denounced.

Each list only covers its own repo. A maintainer can't see that a newcomer is already trusted, or already denounced, somewhere else. A contributor vouched in five projects starts from zero in the sixth.

Vouch Explorer joins those lists into one graph. Look up a person or a repo and you see every project that has vouched for or denounced them, who made each decision, and a short AI summary of their public work. The tool shows the evidence, and the maintainer makes the decision.

## How it works

1. **Find the lists.** For a repo, the app reads `VOUCHED.td` or `.github/VOUCHED.td` straight from `raw.githubusercontent.com`. For a person, GitHub code search finds every list that mentions them. Copies in other paths, such as `vendor/ghostty/.github/VOUCHED.td`, are skipped so one project's decisions aren't credited to another.
2. **Parse them.** The parser handles optional `platform:` prefixes, notes, and the `+ handle` / `- handle` style. It has unit tests.
3. **Find the voucher.** Each line is attributed to the commit that last added or changed it, within the file's last 30 commits. The voucher is that commit's author, but only when GitHub links the commit to an account. Otherwise it stays "unknown"; it is never guessed.
4. **Draw the graph.** Cytoscape.js draws the result. Green solid edges are vouches, denounced users sit on a red inner ring, and dashed edges mean the voucher is unknown. Click a node to re-centre on it.
5. **Write the brief.** The profile page sends the person's public PRs, reviews and issues to an LLM and asks for a contribution brief. The model cites short IDs (`c3`, `a1`, `i42`) instead of URLs, and the server maps them back to real links, so every piece of evidence points at something that exists. The vouch facts next to the brief ("Denounced in 7 indexed projects with the note “Bad AI etiquette”") come from the data, not from the model.

### Screens

| Screen | What it shows |
| --- | --- |
| **Explore** `/` | The trust graph for a GitHub user or an `owner/repo`, with fullscreen, fit, and a link to the profile. |
| **Profile** `/u/:handle` | The AI contribution brief with linked evidence, the vouch facts, and activity per project. |
| **AI queue** (header) | Every model job, running or queued, with a **Cancel** button. Closing a profile cancels its brief. |

### AI rules

- No auto-vouch, no auto-denounce, no reputation score.
- Every prompt says: use only the data provided; if evidence is missing, say so; do not rate the person; do not recommend vouching or denouncing.
- Output is constrained by a JSON schema and validated with zod.
- Only public data: public `VOUCHED.td` files and public GitHub activity.

The default model is `openai/gpt-oss-120b` on [Groq](https://groq.com). Any Groq model with JSON-schema output works through `GROQ_MODEL`.

## Stack

- **Next.js 16** (App Router, server actions, route handlers for cancellable AI calls)
- **TanStack Query** for loading, error and cancel states
- **Octokit** for code search, file history, users and contributions
- **Groq** for the model, with one first-in-first-out queue and abortable requests
- **Cytoscape.js** for the graph, **[Arc UI](https://uiarc.dev)** components, **vitest** for tests

There is no database yet. Data is read live from GitHub and cached in memory with Next's `"use cache"`, so it is lost on restart.

## Run it

```bash
cp .env.example .env    # GROQ_API_KEY; GITHUB_TOKEN (falls back to `gh auth token`) turns on person search
npm ci
npm run dev             # http://localhost:3000
npm test                # parser and AI grounding tests
```

- Repo lookups (`owner/repo`) work without a token. Person lookups need `GITHUB_TOKEN`, because GitHub code search refuses anonymous calls.
- `GET /api/trust?q=<handle|owner/repo>` returns the same data as JSON.

## Limits

- Forks that keep the original list inflate some counts.
- A person search covers at most the first 12 repos code search returns, and GitHub doesn't index every repo (forks, for one).
- Without a database there is no history, so "Recently vouched" is empty for now.

## Next steps

- A database with GitHub login
- Repos that match your profile, and a feed of recent vouches
- Writing maintainer decisions back to `VOUCHED.td` as pull requests
- Excluding forks from counts
- Other forges (GitLab, Codeberg)

## Contributors

- **Alessandro De Stefano** ([@deste04](https://github.com/deste04))
- **Alessandro La Conca** ([@Calonca](https://github.com/Calonca))
- **Fabian** ([@fabianhogger](https://github.com/fabianhogger))

Vouch and the `VOUCHED.td` format are by [Mitchell Hashimoto](https://github.com/mitchellh/vouch); this project only reads them.

## License

MIT. See [LICENSE](LICENSE).
