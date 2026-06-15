type PrismHandoffPayload = {
  documentId: string;
  documentName: string;
  mimeType: string;
  contentText: string;
  summary?: string | null;
  systemType?: string | null;
  sourceUrl?: string | null;
  contentHash?: string | null;
};

export type PrismHandoffResult = {
  memoryInboxId?: string | null;
  memoryInboxUrl?: string | null;
  hookRunId?: string | null;
  hookRequestId?: string | null;
  hookArtifactId?: string | null;
  status: "sent" | "partial" | "skipped" | "failed";
  errors: string[];
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function trimBaseURL(value: string | undefined): string | undefined {
  return value?.replace(/\/+$/, "");
}

export function getPrismIntegrationConfig() {
  return {
    agentBaseURL: trimBaseURL(env("PRISM_AGENT_API_BASE_URL")),
    agentServiceToken: env("PRISM_AGENT_SERVICE_TOKEN"),
    hookKey: env("PRISM_DOCUMENT_HOOK_KEY") ?? "crm-document-uploaded",
    memoryBaseURL: trimBaseURL(env("PRISM_MEMORY_BASE_URL") ?? env("PRISM_API_BASE")),
    memoryApiKey: env("PRISM_API_KEY") ?? env("PRISM_API_WRITE_KEY"),
    codexRuntimeURL: trimBaseURL(env("PRISM_CODEX_RUNTIME_URL")),
    codexRuntimeToken: env("PRISM_CODEX_RUNTIME_TOKEN"),
  };
}

export function isPrismAgentConfigured(): boolean {
  const config = getPrismIntegrationConfig();
  return Boolean(config.agentBaseURL && config.agentServiceToken);
}

export function isPrismMemoryConfigured(): boolean {
  const config = getPrismIntegrationConfig();
  return Boolean(config.memoryBaseURL && config.memoryApiKey);
}

async function postJson(url: string, headers: HeadersInit, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }

  return data;
}

async function sendToPrismMemory(payload: PrismHandoffPayload) {
  const config = getPrismIntegrationConfig();
  if (!config.memoryBaseURL || !config.memoryApiKey) return null;

  return postJson(
    `${config.memoryBaseURL}/memory/inbox`,
    { "X-Prism-Api-Key": config.memoryApiKey },
    {
      source: "nextcrm",
      type: "crm.document.uploaded",
      ts: new Date().toISOString(),
      bucket_hint: "crm-documents",
      author: "nextcrm",
      url: payload.sourceUrl,
      content: payload.contentText,
      metadata: {
        crmDocumentId: payload.documentId,
        documentName: payload.documentName,
        mimeType: payload.mimeType,
        contentHash: payload.contentHash,
        summary: payload.summary,
        systemType: payload.systemType,
      },
    },
  );
}

async function triggerPrismDocumentHook(payload: PrismHandoffPayload) {
  const config = getPrismIntegrationConfig();
  if (!config.agentBaseURL || !config.agentServiceToken) return null;

  return postJson(
    `${config.agentBaseURL}/agent/hooks/${encodeURIComponent(config.hookKey)}/trigger`,
    { "x-service-token": config.agentServiceToken },
    {
      source: "nextcrm",
      event: "crm-document-uploaded",
      document: {
        id: payload.documentId,
        name: payload.documentName,
        mimeType: payload.mimeType,
        url: payload.sourceUrl,
        contentHash: payload.contentHash,
        summary: payload.summary,
        systemType: payload.systemType,
      },
      contentText: payload.contentText,
    },
  );
}

export async function handoffDocumentToPrism(
  payload: PrismHandoffPayload,
): Promise<PrismHandoffResult> {
  const result: PrismHandoffResult = {
    status: "skipped",
    errors: [],
  };

  const [memoryResult, hookResult] = await Promise.allSettled([
    sendToPrismMemory(payload),
    triggerPrismDocumentHook(payload),
  ]);

  if (memoryResult.status === "fulfilled" && memoryResult.value) {
    result.memoryInboxId =
      memoryResult.value.id ?? memoryResult.value.inboxId ?? memoryResult.value.recordId ?? null;
    result.memoryInboxUrl =
      memoryResult.value.url ?? memoryResult.value.artifactUrl ?? memoryResult.value.memoryUrl ?? null;
  } else if (memoryResult.status === "rejected") {
    result.errors.push(`memory: ${memoryResult.reason?.message ?? memoryResult.reason}`);
  }

  if (hookResult.status === "fulfilled" && hookResult.value) {
    result.hookRunId =
      hookResult.value.runId ?? hookResult.value.agentRunId ?? hookResult.value.hookRunId ?? null;
    result.hookRequestId =
      hookResult.value.requestId ?? hookResult.value.request?.id ?? null;
    result.hookArtifactId =
      hookResult.value.artifactId ?? hookResult.value.artifact?.id ?? null;
  } else if (hookResult.status === "rejected") {
    result.errors.push(`hook: ${hookResult.reason?.message ?? hookResult.reason}`);
  }

  const sent = Boolean(
    result.memoryInboxId ||
      result.memoryInboxUrl ||
      result.hookRunId ||
      result.hookRequestId ||
      result.hookArtifactId,
  );
  const configured = isPrismAgentConfigured() || isPrismMemoryConfigured();

  result.status = sent
    ? result.errors.length
      ? "partial"
      : "sent"
    : configured
      ? "failed"
      : "skipped";

  return result;
}
