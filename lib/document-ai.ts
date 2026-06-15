import { callPrismCodexRuntime } from "./prism-agent";
import {
  createOpenAICompatibleClient,
  getOpenAIChatModel,
} from "./openai-compatible";

type DocumentAiProvider = "openai-compatible" | "prism" | "prism-codex";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getDocumentAiProvider(): DocumentAiProvider {
  const provider = env("DOCUMENT_AI_PROVIDER")?.toLowerCase();
  if (provider === "prism") return "prism";
  if (provider === "prism-codex") return "prism-codex";
  return "openai-compatible";
}

export function getDocumentAiModel(): string {
  return getDocumentAiProvider().startsWith("prism")
    ? env("DOCUMENT_AI_MODEL") ?? "prism-codex-runtime"
    : getOpenAIChatModel();
}

async function runOpenAICompatibleChat(input: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string | null> {
  const openai = createOpenAICompatibleClient();
  const response = await openai.chat.completions.create({
    model: getOpenAIChatModel(),
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    max_tokens: input.maxTokens,
  });

  return response.choices[0]?.message?.content ?? null;
}

async function runPrismDocumentPrompt(input: {
  task: "summary" | "classification";
  system: string;
  user: string;
}): Promise<string | null> {
  const response = await callPrismCodexRuntime({
    sessionId: `document-ai-${input.task}`,
    prompt: `${input.system}\n\n${input.user}`,
    metadata: {
      provider: "prism",
      domain: "document-ai",
      task: input.task,
    },
  });

  return response.responseText ?? response.output_text ?? null;
}

export async function summarizeDocumentWithAi(content: string): Promise<string | null> {
  const truncated = content.slice(0, 12000);
  const system =
    "Summarize the following document in 2-3 concise sentences. Focus on the key purpose and contents.";

  if (getDocumentAiProvider() === "prism-codex") {
    return runPrismDocumentPrompt({
      task: "summary",
      system,
      user: truncated,
    });
  }

  return runOpenAICompatibleChat({
    system,
    user: truncated,
    maxTokens: 200,
  });
}

export async function classifyDocumentWithAi(input: {
  documentName: string;
  summary: string | null;
  content: string;
}): Promise<"RECEIPT" | "CONTRACT" | "OFFER" | "OTHER"> {
  const truncated = input.content.slice(0, 4000);
  const system =
    "Classify this document into exactly one of these categories: RECEIPT, CONTRACT, OFFER, OTHER. Respond with only the category name, nothing else.";
  const user = `Document name: ${input.documentName}\n\nSummary: ${input.summary}\n\nContent excerpt:\n${truncated}`;

  const rawResponse = getDocumentAiProvider() === "prism-codex"
    ? await runPrismDocumentPrompt({
        task: "classification",
        system,
        user,
      })
    : await runOpenAICompatibleChat({
        system,
        user,
        maxTokens: 10,
      });

  const raw = rawResponse?.trim().toUpperCase() ?? "OTHER";
  return ["RECEIPT", "CONTRACT", "OFFER", "OTHER"].includes(raw)
    ? (raw as "RECEIPT" | "CONTRACT" | "OFFER" | "OTHER")
    : "OTHER";
}
