// MCP endpoint (Streamable HTTP), for AI chats: add <site>/api/mcp as a connector. The tools live in @/server/mcp.
// Stateless: a fresh server and transport per request, JSON responses instead of an SSE stream, no session ids.
// Read-only and public data only, like /api/trust; a signed-in browser reads with its own token, anyone else with
// the server's.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { vouchMcpServer } from "@/server/mcp";
import { readAsViewer } from "@/server/session";

async function handle(request: Request): Promise<Response> {
  await readAsViewer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await vouchMcpServer().connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
