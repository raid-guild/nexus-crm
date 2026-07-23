import { createMcpHandler } from "mcp-handler";
import { getMcpUser } from "@/lib/mcp/auth";
import { crmLeadAgentTools } from "@/lib/mcp/tools/crm-leads";

const handler = createMcpHandler(
  (server) => {
    for (const tool of crmLeadAgentTools) {
      server.tool(
        tool.name,
        tool.description,
        tool.schema.shape,
        async (args: Record<string, unknown>) => {
          try {
            const mcpUser = await getMcpUser();
            const result = await tool.handler(args as never, mcpUser.id);
            return {
              content: [
                { type: "text" as const, text: JSON.stringify(result) },
              ],
            };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            const code =
              msg === "NOT_FOUND"
                ? "NOT_FOUND"
                : msg === "Unauthorized"
                  ? "UNAUTHORIZED"
                  : msg.startsWith("CONFLICT:")
                    ? "INVALID_REQUEST"
                    : msg.startsWith("VALIDATION_ERROR:")
                      ? "INVALID_PARAMS"
                      : "INTERNAL_ERROR";
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ error: msg, code }),
                },
              ],
              isError: true,
            };
          }
        },
      );
    }
  },
  {
    capabilities: { tools: {} },
  },
  {
    basePath: "/api/mcp-leads",
  },
);

export { handler as GET, handler as POST };
