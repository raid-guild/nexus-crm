import OpenAI from "openai";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_VENICE_BASE_URL = "https://api.venice.ai/api/v1";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getOpenAICompatibleApiKey(): string | undefined {
  const provider = env("AI_EMBEDDINGS_PROVIDER")?.toLowerCase();
  const baseURL = env("OPENAI_BASE_URL") ?? env("OPENAI_COMPATIBLE_BASE_URL");

  if (provider === "venice" || baseURL?.includes("venice.ai")) {
    return env("VENICE_API_KEY") ?? env("OPENAI_API_KEY") ?? env("OPEN_AI_API_KEY");
  }

  return env("OPENAI_API_KEY") ?? env("OPEN_AI_API_KEY") ?? env("VENICE_API_KEY");
}

export function getOpenAICompatibleBaseURL(): string | undefined {
  const explicit = env("OPENAI_BASE_URL") ?? env("OPENAI_COMPATIBLE_BASE_URL");
  if (explicit) return explicit;
  return env("AI_EMBEDDINGS_PROVIDER")?.toLowerCase() === "venice"
    ? DEFAULT_VENICE_BASE_URL
    : undefined;
}

export function getOpenAIChatModel(): string {
  return env("OPENAI_CHAT_MODEL") ?? "gpt-4o-mini";
}

export function getEmbeddingConfig() {
  const configuredDimensions = Number(env("OPENAI_EMBEDDING_DIMENSIONS"));
  return {
    model: env("OPENAI_EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL,
    dimensions: Number.isFinite(configuredDimensions) && configuredDimensions > 0
      ? configuredDimensions
      : DEFAULT_EMBEDDING_DIMENSIONS,
  };
}

export function createOpenAICompatibleClient(apiKey?: string): OpenAI {
  const resolvedApiKey = apiKey ?? getOpenAICompatibleApiKey();
  if (!resolvedApiKey) {
    throw new Error("Missing OPENAI_API_KEY or VENICE_API_KEY");
  }

  return new OpenAI({
    apiKey: resolvedApiKey,
    baseURL: getOpenAICompatibleBaseURL(),
  });
}

export function assertEmbeddingDimensions(embedding: number[]): void {
  const { dimensions } = getEmbeddingConfig();
  if (embedding.length !== dimensions) {
    throw new Error(`Expected ${dimensions}-dimension embedding, got ${embedding.length}`);
  }
}
