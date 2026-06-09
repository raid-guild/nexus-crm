export type PrismRuntimeResponse = {
  ok?: boolean;
  responseText?: string;
  output_text?: string;
  thread_id?: string | null;
  trace?: Array<{ at: string; kind: string; message: string }>;
};

export async function callPrismCodexRuntime(input: {
  prompt: string;
  sessionId: string;
  codexThreadId?: string | null;
  recentHistory?: Array<{ role: string; content: string }>;
  metadata?: Record<string, unknown>;
}): Promise<PrismRuntimeResponse> {
  const baseURL = process.env.PRISM_CODEX_RUNTIME_URL?.trim()?.replace(/\/+$/, "");
  if (!baseURL) {
    throw new Error("Missing PRISM_CODEX_RUNTIME_URL");
  }

  const response = await fetch(`${baseURL}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PRISM_CODEX_RUNTIME_TOKEN
        ? { Authorization: `Bearer ${process.env.PRISM_CODEX_RUNTIME_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Prism Codex Runtime failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<PrismRuntimeResponse>;
}
