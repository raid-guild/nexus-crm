import { crmLeadSegmentTools } from "@/lib/mcp/tools/crm-lead-segments";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Lead_Segments: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    crm_Leads: {
      findMany: jest.fn(),
    },
    crm_LeadSegmentMembers: {
      createMany: jest.fn(),
    },
  },
}));

const mockPrisma = prismadb as jest.Mocked<typeof prismadb>;

function tool(name: string): any {
  const found = crmLeadSegmentTools.find((entry) => entry.name === name);
  if (!found) throw new Error(`Tool ${name} not found`);
  return found;
}

describe("crm lead segment MCP tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists segments created by the authenticated user with member counts", async () => {
    const createdAt = new Date("2026-06-25T10:00:00Z");
    (mockPrisma.crm_Lead_Segments.findMany as jest.Mock).mockResolvedValue([
      {
        id: "segment-1",
        name: "Handymen - Southern Colorado",
        description: "Outbound test",
        audience: "Handymen",
        region: "Southern Colorado",
        source: "Scrape",
        criteria: { trade: "handyman" },
        createdAt,
        updatedAt: null,
        _count: { members: 12 },
      },
    ]);
    (mockPrisma.crm_Lead_Segments.count as jest.Mock).mockResolvedValue(1);

    const result = await tool("crm_list_lead_segments").handler(
      { limit: 20, offset: 0 },
      "user-1",
    );

    expect(mockPrisma.crm_Lead_Segments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdBy: "user-1", deletedAt: null },
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: "segment-1",
          name: "Handymen - Southern Colorado",
          description: "Outbound test",
          audience: "Handymen",
          region: "Southern Colorado",
          source: "Scrape",
          criteria: { trade: "handyman" },
          createdAt,
          updatedAt: null,
          leadCount: 12,
        },
      ],
      total: 1,
      offset: 0,
    });
  });

  it("creates a segment owned by the authenticated user", async () => {
    (mockPrisma.crm_Lead_Segments.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.crm_Lead_Segments.create as jest.Mock).mockResolvedValue({
      id: "segment-1",
      name: "Handymen - Southern Colorado",
      createdBy: "user-1",
    });

    const result = await tool("crm_create_lead_segment").handler(
      {
        name: "Handymen - Southern Colorado",
        audience: "Handymen",
        region: "Southern Colorado",
        source: "Scrape",
        criteria: { trade: "handyman" },
      },
      "user-1",
    );

    expect(mockPrisma.crm_Lead_Segments.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Handymen - Southern Colorado",
        audience: "Handymen",
        region: "Southern Colorado",
        source: "Scrape",
        createdBy: "user-1",
      }),
    });
    expect(result.data.id).toBe("segment-1");
  });

  it("adds only assigned leads to a user-owned segment", async () => {
    (mockPrisma.crm_Lead_Segments.findFirst as jest.Mock).mockResolvedValue({
      id: "segment-1",
    });
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([
      { id: "lead-1" },
      { id: "lead-2" },
    ]);
    (mockPrisma.crm_LeadSegmentMembers.createMany as jest.Mock).mockResolvedValue({
      count: 2,
    });

    const result = await tool("crm_add_leads_to_segment").handler(
      {
        segment_id: "segment-1",
        lead_ids: ["lead-1", "lead-2", "lead-2"],
        status: "candidate",
      },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["lead-1", "lead-2"] },
        assigned_to: "user-1",
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(mockPrisma.crm_LeadSegmentMembers.createMany).toHaveBeenCalledWith({
      data: [
        {
          lead_id: "lead-1",
          segment_id: "segment-1",
          import_batch_id: undefined,
          status: "candidate",
        },
        {
          lead_id: "lead-2",
          segment_id: "segment-1",
          import_batch_id: undefined,
          status: "candidate",
        },
      ],
      skipDuplicates: true,
    });
    expect(result.data).toEqual({
      segment_id: "segment-1",
      requested: 2,
      added: 2,
    });
  });

  it("rejects segment membership for leads outside the authenticated user's scope", async () => {
    (mockPrisma.crm_Lead_Segments.findFirst as jest.Mock).mockResolvedValue({
      id: "segment-1",
    });
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([
      { id: "lead-1" },
    ]);

    await expect(
      tool("crm_add_leads_to_segment").handler(
        { segment_id: "segment-1", lead_ids: ["lead-1", "lead-2"] },
        "user-1",
      ),
    ).rejects.toThrow("VALIDATION_ERROR");
    expect(mockPrisma.crm_LeadSegmentMembers.createMany).not.toHaveBeenCalled();
  });
});
