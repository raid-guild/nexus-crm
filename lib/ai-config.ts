import { getEmbeddingConfig, getOpenAICompatibleBaseURL } from "./openai-compatible";
import { getDocumentAiModel, getDocumentAiProvider } from "./document-ai";

type IntegrationState = "ready" | "missing" | "partial";

export type AiIntegrationStatus = {
  embeddings: {
    provider: string;
    state: IntegrationState;
    apiKeyConfigured: boolean;
    baseURL: string;
    model: string;
    dimensions: number;
  };
  agentRuntime: {
    provider: string;
    state: IntegrationState;
    urlConfigured: boolean;
    tokenConfigured: boolean;
    url: string | null;
    health: "not_configured" | "reachable" | "failed";
  };
  documentAi: {
    provider: string;
    state: IntegrationState;
    model: string;
    runtimeUrlConfigured: boolean;
    runtimeTokenConfigured: boolean;
    health: "not_configured" | "reachable" | "failed" | "not_applicable";
  };
};

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function getAgentRuntimeURL(): string | null {
  const value = process.env.PRISM_CODEX_RUNTIME_URL?.trim();
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

async function checkPrismHealth(url: string | null): Promise<AiIntegrationStatus["agentRuntime"]["health"]> {
  if (!url) return "not_configured";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${url}/codex/health`, {
      cache: "no-store",
      signal: controller.signal,
      headers: process.env.PRISM_CODEX_RUNTIME_TOKEN
        ? { Authorization: `Bearer ${process.env.PRISM_CODEX_RUNTIME_TOKEN}` }
        : undefined,
    });
    return response.ok ? "reachable" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAiIntegrationStatus(): Promise<AiIntegrationStatus> {
  const embeddingConfig = getEmbeddingConfig();
  const baseURL = getOpenAICompatibleBaseURL() ?? "https://api.openai.com/v1";
  const apiKeyConfigured =
    hasEnv("OPENAI_API_KEY") || hasEnv("OPEN_AI_API_KEY") || hasEnv("VENICE_API_KEY");
  const agentURL = getAgentRuntimeURL();
  const agentTokenConfigured = hasEnv("PRISM_CODEX_RUNTIME_TOKEN");
  const agentHealth = await checkPrismHealth(agentURL);
  const documentAiProvider = getDocumentAiProvider();
  const documentAiUsesPrism = documentAiProvider === "prism";
  const documentAiState = documentAiUsesPrism
    ? !agentURL
      ? "missing"
      : agentHealth === "reachable"
        ? "ready"
        : "partial"
    : apiKeyConfigured
      ? "ready"
      : "missing";

  return {
    embeddings: {
      provider: process.env.AI_EMBEDDINGS_PROVIDER?.trim() || (baseURL.includes("venice.ai") ? "venice" : "openai-compatible"),
      state: apiKeyConfigured ? "ready" : "missing",
      apiKeyConfigured,
      baseURL,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
    },
    agentRuntime: {
      provider: process.env.AI_AGENT_PROVIDER?.trim() || "prism",
      state: !agentURL ? "missing" : agentHealth === "reachable" ? "ready" : "partial",
      urlConfigured: Boolean(agentURL),
      tokenConfigured: agentTokenConfigured,
      url: agentURL,
      health: agentHealth,
    },
    documentAi: {
      provider: documentAiProvider,
      state: documentAiState,
      model: getDocumentAiModel(),
      runtimeUrlConfigured: documentAiUsesPrism ? Boolean(agentURL) : false,
      runtimeTokenConfigured: documentAiUsesPrism ? agentTokenConfigured : false,
      health: documentAiUsesPrism ? agentHealth : "not_applicable",
    },
  };
}
