// Vouch Explorer as MCP tools, so any AI chat (Claude, ChatGPT, Cursor…) can read the trust graph. Same data as
// /api/trust and the profile page, read live from GitHub. The chat's own model writes the answer: no Groq call here.
// Tools return facts and real GitHub URLs only, never a score; the instructions carry the same rules as our prompts.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cleanQuery, isGithubLogin } from "../lib/query";
import { SITE_NAME, SITE_URL } from "../lib/site";
import { exploreSearch, vouchersFor } from "./actions/explore";
import { RULES } from "./ai/tasks";
import { getUser, repoActivity, userContributions, type Contribution } from "./github";
import { serverTokenFailed } from "./githubCore";
import type { TrustEdge } from "./trust/types";

/** Entries returned per call: big projects (ghostty) list hundreds, which would flood the chat's context. */
const MAX_EDGES = 150;
/** Repos and contributions returned by contributor_activity. */
const MAX_REPOS = 30;
/** Recent contributions per kind, so reviews and issues aren't crowded out by PRs. */
const RECENT: Record<Contribution["kind"], number> = { pr: 20, review: 10, issue: 10 };

const INSTRUCTIONS =
  `${SITE_NAME} reads public Vouch lists (VOUCHED.td) from GitHub: which projects vouched for or denounced a ` +
  "contributor, who made each decision, and the person's public activity. A voucher of null means unknown, never " +
  "guess one. Link to the URLs the tools return; do not invent others. Explain the evidence, the maintainer decides. " +
  RULES;

const ISSUES: Record<string, string> = {
  no_vouch_file: "This repo has no VOUCHED.td (checked VOUCHED.td and .github/VOUCHED.td).",
  needs_token: "Person search is off: the server has no GitHub token.",
  rate_limited: "GitHub rate limit reached. Try again in a minute.",
  unavailable: "GitHub did not answer.",
};

const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });
const limitHit = () => (serverTokenFailed() ? fail(ISSUES.rate_limited) : null);

const commitUrl = (e: TrustEdge) => (e.commit_sha ? `https://github.com/${e.project}/commit/${e.commit_sha}` : null);
const edgeOut = (e: TrustEdge) => ({
  project: e.project,
  login: e.login,
  status: e.status,
  note: e.note,
  voucher: e.voucher,
  date: e.occurred_at,
  commit: commitUrl(e),
});

/** The newest few of each kind (contributions come newest first within each kind). */
function recentMix(all: Contribution[]): Contribution[] {
  const seen = { pr: 0, review: 0, issue: 0 };
  return all.filter((c) => seen[c.kind]++ < RECENT[c.kind]);
}

export function vouchMcpServer(): McpServer {
  const server = new McpServer({ name: "vouch-explorer", title: SITE_NAME, version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "trust_lookup",
    {
      title: "Trust lookup",
      description:
        "Vouch list entries for a GitHub user (every project that vouched for or denounced them) or for a repo " +
        "(everyone its VOUCHED.td vouches for or denounces). Each entry has the voucher (author of the commit that " +
        "wrote the line, null when unknown), the maintainer's note and the commit URL. Slow for people: up to ~30s.",
      inputSchema: {
        query: z.string().max(120).regex(/^@?[A-Za-z0-9][A-Za-z0-9._\/-]*$/).describe("A GitHub login (e.g. mitchellh) or owner/repo (e.g. ghostty-org/ghostty)"),
        status: z.enum(["vouched", "denounced"]).optional().describe("Only entries with this status"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, status }) => {
      const { kind, q, edges: listed, issue } = await exploreSearch(query);
      if (issue) return limitHit() ?? fail(ISSUES[issue]);
      const edges = kind === "user" ? await vouchersFor(q, listed) : listed;
      const kept = status ? edges.filter((e) => e.status === status) : edges;
      return json({
        kind,
        query: q,
        vouched: edges.filter((e) => e.status === "vouched").length,
        denounced: edges.filter((e) => e.status === "denounced").length,
        unknown_voucher: edges.filter((e) => !e.voucher).length,
        // People: lists copied from a larger one (forks) come after the originals, see groupCopies in ../vouch.ts.
        entries: kept.slice(0, MAX_EDGES).map(edgeOut),
        truncated: kept.length > MAX_EDGES ? `${kept.length - MAX_EDGES} more entries not shown; filter by status to narrow.` : undefined,
        explore_url: new URL(`/?q=${encodeURIComponent(q)}`, SITE_URL).toString(),
      });
    },
  );

  server.registerTool(
    "contributor_activity",
    {
      title: "Contributor activity",
      description:
        "A GitHub user's public profile, contributions per repo (commits, PRs, issues, reviews) with the vouch " +
        "status where a project lists them, and recent PRs, reviews and issues with their URLs, for citing evidence.",
      inputSchema: {
        login: z.string().max(40).describe("A GitHub login, e.g. mitchellh"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ login: raw }) => {
      const login = cleanQuery(raw);
      if (!isGithubLogin(login)) return fail("Not a GitHub login.");
      const [user, counts, contributions, listed] = await Promise.all([
        getUser(login).catch(() => undefined),
        repoActivity(login).catch(() => null),
        userContributions(login).catch(() => []),
        exploreSearch(login),
      ]);
      if (user === null) return fail(`No GitHub user named ${login}.`);
      if (user === undefined) return limitHit() ?? fail(ISSUES.unavailable);
      const vouch = new Map(listed.edges.map((e) => [e.project.toLowerCase(), e.status]));
      const total = (n: { commits: number; prs: number; issues: number; reviews: number }) => n.commits + n.prs + n.issues + n.reviews;
      const repos = Object.entries(counts ?? {})
        .map(([repo, n]) => ({ repo, ...n, vouch: vouch.get(repo.toLowerCase()) ?? null }))
        .sort((a, b) => total(b) - total(a))
        .slice(0, MAX_REPOS);
      return json({
        user: { login: user.login, name: user.name, bio: user.bio, url: user.html_url, created_at: user.created_at },
        // Per-repo counts come from GraphQL, which needs a token.
        repos: counts ? repos : "unknown (GitHub did not give per-repo counts)",
        vouch_lists: listed.issue ? `unknown (${ISSUES[listed.issue]})` : { vouched_in: listed.edges.filter((e) => e.status === "vouched").length, denounced_in: listed.edges.filter((e) => e.status === "denounced").length },
        recent: recentMix(contributions).map(({ kind, title, repo, state, url, created_at }) => ({ kind, title, repo, state, url, date: created_at })),
        profile_url: new URL(`/u/${user.login}`, SITE_URL).toString(),
      });
    },
  );

  return server;
}
