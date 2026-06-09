import { createHash } from "crypto";
import {
  assertEmbeddingDimensions,
  createOpenAICompatibleClient,
  getEmbeddingConfig,
} from "@/lib/openai-compatible";

/**
 * Concatenate non-null text fields into a single embedding string.
 * Filters out null/undefined/empty values before joining.
 */
export function buildEmbeddingText(fields: (string | null | undefined)[]): string {
  return fields
    .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
    .join(" ");
}

/**
 * Compute a SHA-256 hash of the text for change detection.
 */
export function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Generate an embedding vector via the configured OpenAI-compatible provider.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = createOpenAICompatibleClient();
  const { model, dimensions } = getEmbeddingConfig();
  const response = await openai.embeddings.create({
    model,
    input: text,
    dimensions,
  });
  const embedding = response.data[0].embedding;
  assertEmbeddingDimensions(embedding);
  return embedding;
}

/**
 * Format a number[] embedding as a pgvector literal string.
 * Example: [0.1, 0.2, ...] → '[0.1,0.2,...]'
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
