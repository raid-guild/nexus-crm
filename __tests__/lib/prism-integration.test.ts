import { handoffDocumentToPrism } from "@/lib/prism-integration";

const ENV_KEYS = [
  "PRISM_AGENT_API_BASE_URL",
  "PRISM_AGENT_SERVICE_TOKEN",
  "PRISM_DOCUMENT_HOOK_KEY",
  "PRISM_MEMORY_BASE_URL",
  "PRISM_API_BASE",
  "PRISM_API_KEY",
  "PRISM_API_WRITE_KEY",
  "DOCUMENT_AI_MODEL",
] as const;

const payload = {
  documentId: "doc-123",
  documentName: "proposal.txt",
  mimeType: "text/plain",
  contentText: "Proposal body",
  summary: "A short summary",
  systemType: "OFFER",
  sourceUrl: "minio://bucket/proposal.txt",
  contentHash: "hash-123",
};

function mockResponse(input: {
  ok: boolean;
  status?: number;
  statusText?: string;
  text?: string;
}) {
  return {
    ok: input.ok,
    status: input.status ?? (input.ok ? 200 : 500),
    statusText: input.statusText ?? (input.ok ? "OK" : "Server Error"),
    text: jest.fn().mockResolvedValue(input.text ?? ""),
  } as unknown as Response;
}

describe("handoffDocumentToPrism", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    global.fetch = jest.fn();
  });

  it("skips when neither Prism Memory nor Agent API is configured", async () => {
    const result = await handoffDocumentToPrism(payload);

    expect(result.status).toBe("skipped");
    expect(result.errors).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("marks configured 2xx responses as sent even when Prism returns no ids", async () => {
    process.env.PRISM_MEMORY_BASE_URL = "https://prism.example";
    process.env.PRISM_API_KEY = "memory-key";
    process.env.PRISM_AGENT_API_BASE_URL = "https://agent.example";
    process.env.PRISM_AGENT_SERVICE_TOKEN = "agent-token";

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 204 }))
      .mockResolvedValueOnce(mockResponse({ ok: true, text: JSON.stringify({ ok: true }) }));

    const result = await handoffDocumentToPrism(payload);

    expect(result.status).toBe("sent");
    expect(result.errors).toEqual([]);
  });

  it("returns partial and sanitizes response bodies when one configured endpoint fails", async () => {
    process.env.PRISM_MEMORY_BASE_URL = "https://prism.example";
    process.env.PRISM_API_KEY = "memory-key";
    process.env.PRISM_AGENT_API_BASE_URL = "https://agent.example";
    process.env.PRISM_AGENT_SERVICE_TOKEN = "agent-token";

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse({ ok: true, text: JSON.stringify({ id: "mem-1" }) }))
      .mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          statusText: "Server Error",
          text: "secret upstream details",
        }),
      );

    const result = await handoffDocumentToPrism(payload);

    expect(result.status).toBe("partial");
    expect(result.memoryInboxId).toBe("mem-1");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("HTTP 500");
    expect(result.errors[0]).toContain("response body 23 bytes");
    expect(result.errors[0]).not.toContain("secret upstream details");
  });

  it("includes DOCUMENT_AI_MODEL in Prism Memory metadata and Agent hook payloads", async () => {
    process.env.PRISM_MEMORY_BASE_URL = "https://prism.example";
    process.env.PRISM_API_KEY = "memory-key";
    process.env.PRISM_AGENT_API_BASE_URL = "https://agent.example";
    process.env.PRISM_AGENT_SERVICE_TOKEN = "agent-token";
    process.env.DOCUMENT_AI_MODEL = "crm-document-workflow";

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse({ ok: true, text: JSON.stringify({ id: "mem-1" }) }))
      .mockResolvedValueOnce(mockResponse({ ok: true, text: JSON.stringify({ runId: "run-1" }) }));

    await handoffDocumentToPrism(payload);

    const memoryBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const hookBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);

    expect(memoryBody.metadata.documentAiModel).toBe("crm-document-workflow");
    expect(hookBody.documentAi).toEqual({
      provider: "prism",
      model: "crm-document-workflow",
    });
  });
});
