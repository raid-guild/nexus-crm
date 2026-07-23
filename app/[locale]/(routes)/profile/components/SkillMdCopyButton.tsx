"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

const MCP_CONFIG = `{
  "mcpServers": {
    "nextcrm": {
      "type": "http",
      "url": "https://YOUR_NEXTCRM_URL/api/mcp/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_TOKEN" }
    }
  }
}`;

const LEAD_MCP_CONFIG = `{
  "mcpServers": {
    "nextcrm-leads": {
      "type": "http",
      "url": "https://YOUR_NEXTCRM_URL/api/mcp-leads/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_TOKEN" }
    }
  }
}`;

type Props = {
  mode?: "full" | "leads";
};

export function SkillMdCopyButton({ mode = "full" }: Props) {
  const [copied, setCopied] = useState(false);
  const isLeadOnly = mode === "leads";

  function handleCopy() {
    navigator.clipboard.writeText(isLeadOnly ? LEAD_MCP_CONFIG : MCP_CONFIG);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied
        ? "Copied!"
        : isLeadOnly
          ? "Copy Lead MCP Config"
          : "Copy MCP Config"}
    </button>
  );
}
