import { crmLeadTools } from "@/lib/mcp/tools/crm-leads";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Lead_Statuses: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    crm_Leads: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockPrisma = prismadb as jest.Mocked<typeof prismadb>;

function tool(name: string): any {
  const found = crmLeadTools.find((entry) => entry.name === name);
  if (!found) throw new Error(`Tool ${name} not found`);
  return found;
}

describe("crm lead MCP tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists lead statuses in board order", async () => {
    (mockPrisma.crm_Lead_Statuses.findMany as jest.Mock).mockResolvedValue([
      { id: "lost", name: "Lost" },
      { id: "follow-up", name: "Follow Up" },
      { id: "new", name: "New" },
      { id: "custom", name: "Custom" },
    ]);

    const result = await tool("crm_list_lead_statuses").handler({}, "user-1");

    expect(result).toEqual({
      data: [
        { id: "new", name: "New" },
        { id: "follow-up", name: "Follow Up" },
        { id: "lost", name: "Lost" },
        { id: "custom", name: "Custom" },
      ],
      total: 4,
      offset: 0,
    });
  });

  it("updates an assigned lead status by exact status name", async () => {
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue({ id: "lead-1" });
    (mockPrisma.crm_Lead_Statuses.findFirst as jest.Mock).mockResolvedValue({
      id: "status-follow-up",
    });
    (mockPrisma.crm_Leads.update as jest.Mock).mockResolvedValue({
      id: "lead-1",
      lead_status_id: "status-follow-up",
      lead_status: { id: "status-follow-up", name: "Follow Up" },
    });

    const result = await tool("crm_update_lead_status").handler(
      { id: "lead-1", lead_status_name: "Follow Up" },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.findFirst).toHaveBeenCalledWith({
      where: { id: "lead-1", assigned_to: "user-1", deletedAt: null },
    });
    expect(mockPrisma.crm_Lead_Statuses.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Follow Up", mode: "insensitive" } },
      select: { id: true },
    });
    expect(mockPrisma.crm_Leads.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1" },
        data: { lead_status_id: "status-follow-up", updatedBy: "user-1" },
      }),
    );
    expect(result.data.lead_status.name).toBe("Follow Up");
  });

  it("clears an assigned lead status when lead_status_id is null", async () => {
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue({ id: "lead-1" });
    (mockPrisma.crm_Leads.update as jest.Mock).mockResolvedValue({
      id: "lead-1",
      lead_status_id: null,
      lead_status: null,
    });

    const result = await tool("crm_update_lead_status").handler(
      { id: "lead-1", lead_status_id: null },
      "user-1",
    );

    expect(mockPrisma.crm_Lead_Statuses.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.crm_Leads.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lead_status_id: null, updatedBy: "user-1" },
      }),
    );
    expect(result.data.lead_status_id).toBeNull();
  });

  it("does not update leads outside the authenticated user's scope", async () => {
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      tool("crm_update_lead_status").handler(
        { id: "lead-1", lead_status_name: "Qualified" },
        "user-1",
      ),
    ).rejects.toThrow("NOT_FOUND");
    expect(mockPrisma.crm_Leads.update).not.toHaveBeenCalled();
  });
});
