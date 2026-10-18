import Link from "next/link";
import { CodeBlock } from "@/components/arc/code-block/code-block";
import { REPO_URL } from "@/lib/site";

export const metadata = {
  title: "MCP server",
  description: "Use Vouch Explorer from an AI chat: connect its MCP server to Claude, ChatGPT, Cursor or VS Code and ask about vouch lists.",
  alternates: { canonical: "/mcp" },
};

/** The public deployment: the address people paste into their chat, whichever host serves this page. */
const MCP_URL = "https://vouchexplorer.vercel.app/api/mcp";

const CURSOR = `{
  "mcpServers": {
    "vouch-explorer": { "url": "${MCP_URL}" }
  }
}`;

const VSCODE = `{
  "servers": {
    "vouch-explorer": { "type": "http", "url": "${MCP_URL}" }
  }
}`;

const CALL = `curl ${MCP_URL} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"trust_lookup","arguments":{"query":"ghostty-org/ghostty","status":"denounced"}}}'`;

export default function McpPage() {
  return (
    <div className="container legal docs">
      <h1 className="page-title">MCP server</h1>
      <p className="page-sub">Use Vouch Explorer from an AI chat</p>

      <p>
        Vouch Explorer has an <a href="https://modelcontextprotocol.io">MCP</a> server. MCP is the standard way for AI
        assistants to call outside tools. Once you connect it, you can ask your chat about vouch lists in plain words and
        it answers with the same data as the graph, read live from GitHub.
      </p>
      <ul>
        <li>&ldquo;Has anyone denounced @someone? Who, and with what note?&rdquo;</li>
        <li>&ldquo;Who did ghostty-org/ghostty denounce this year?&rdquo;</li>
        <li>&ldquo;Where does @pluiedev contribute, and which of those projects vouched for them?&rdquo;</li>
      </ul>

      <h2>Server address</h2>
      <CodeBlock code={MCP_URL} filename="MCP server" language="text" />
      <p>
        Streamable HTTP, no sign-in, read-only. It reads public data only: public{" "}
        <span className="mono">VOUCHED.td</span> files and public GitHub activity.
      </p>

      <h2>Connect it</h2>
      <h3>Claude</h3>
      <p>
        On claude.ai or the desktop app, open <strong>Settings → Connectors</strong>, choose <strong>Add custom
        connector</strong>, and paste the address above. In Claude Code:
      </p>
      <CodeBlock code={`claude mcp add --transport http vouch-explorer ${MCP_URL}`} filename="Terminal" language="bash" />

      <h3>ChatGPT</h3>
      <p>
        In <strong>Settings → Apps &amp; Connectors</strong>, turn on developer mode, create a connector, and paste the
        address. No authentication is needed.
      </p>

      <h3>Cursor</h3>
      <p>
        Add this to <span className="mono">~/.cursor/mcp.json</span>, or to{" "}
        <span className="mono">.cursor/mcp.json</span> in a project:
      </p>
      <CodeBlock code={CURSOR} filename="mcp.json" language="json" />

      <h3>VS Code</h3>
      <p>
        Add this to <span className="mono">.vscode/mcp.json</span>:
      </p>
      <CodeBlock code={VSCODE} filename=".vscode/mcp.json" language="json" />

      <h2>Tools</h2>
      <h3 className="mono">trust_lookup</h3>
      <p>
        Vouch list entries for a GitHub user or an <span className="mono">owner/repo</span>. For a person, every
        project that vouched for or denounced them. For a repo, everyone its list vouches for or denounces.
      </p>
      <ul>
        <li>
          <span className="mono">query</span>: a login (<span className="mono">mitchellh</span>) or a repo (
          <span className="mono">ghostty-org/ghostty</span>).
        </li>
        <li>
          <span className="mono">status</span> (optional): <span className="mono">vouched</span> or{" "}
          <span className="mono">denounced</span>.
        </li>
      </ul>
      <p>
        Each entry has the project, the status, the maintainer&apos;s note, the voucher, the date and a link to the
        commit that wrote the line. The voucher is the author of that commit. It is <span className="mono">null</span>{" "}
        when GitHub doesn&apos;t link the commit to an account, and it is never guessed. At most 150 entries come back
        per call. Use <span className="mono">status</span> to narrow a large list.
      </p>

      <h3 className="mono">contributor_activity</h3>
      <p>
        A person&apos;s public profile, their contributions per repo (commits, pull requests, issues, reviews) with the
        vouch status where a project lists them, and their recent pull requests, reviews and issues with links.
      </p>
      <ul>
        <li>
          <span className="mono">login</span>: a GitHub login.
        </li>
      </ul>

      <h2>What the chat is told</h2>
      <p>The server gives every chat the same rules as the AI brief on profile pages:</p>
      <ul>
        <li>Use only the data the tools return. If evidence is missing, say so.</li>
        <li>Don&apos;t rate or score the person, and don&apos;t recommend vouching or denouncing.</li>
        <li>Link only to URLs the tools return. Never guess an unknown voucher.</li>
      </ul>
      <p>
        Your chat&apos;s own model writes the answer. Vouch Explorer doesn&apos;t run a model for these calls and
        doesn&apos;t see your conversation, only the tool calls and their arguments.
      </p>

      <h2>Limits</h2>
      <p>
        Lookups for a person search all of GitHub and can take up to 30 seconds the first time. Results are cached for a
        few hours after that. Every chat shares one GitHub token, so under heavy use a call can fail on GitHub&apos;s
        rate limit. The tool then says so; try again a minute later.
      </p>

      <h2>Try it without a chat</h2>
      <p>The server speaks JSON-RPC over HTTP, so a plain request works too:</p>
      <CodeBlock code={CALL} filename="Terminal" language="bash" />
      <p>
        The same data is also at <span className="mono">GET /api/trust?q=&lt;login or owner/repo&gt;</span>. The source
        is on <a href={REPO_URL}>GitHub</a>. See also <Link href="/privacy">privacy</Link>.
      </p>
    </div>
  );
}
