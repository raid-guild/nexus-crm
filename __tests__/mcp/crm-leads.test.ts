import { crmLeadTools } from "@/lib/mcp/tools/crm-leads";
import { prismadb } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Lead_Statuses: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    crm_Lead_Sources: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    crm_Lead_Types: {
      findMany: jest.fn(),
    },
    crm_Lead_Segments: {
      findFirst: jest.fn(),
    },
    crm_LeadSegmentMembers: {
      createMany: jest.fn(),
    },
    crm_Leads: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crm_Opportunities: {
      create: jest.fn(),
    },
    crm_AuditLog: {
      createMany: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
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

  it("assigns created leads to the authenticated MCP user", async () => {
    (mockPrisma.crm_Leads.create as jest.Mock).mockResolvedValue({
      id: "lead-1",
      assigned_to: "user-1",
    });

    await tool("crm_create_lead").handler(
      { lastName: "Lead", email: "lead@example.com" },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assigned_to: "user-1",
        createdBy: "user-1",
        updatedBy: "user-1",
      }),
    });
  });

  it("creates a lead assigned to a requested user and maps account_id", async () => {
    (mockPrisma.users.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user-1", role: "manager" })
      .mockResolvedValueOnce({ id: "user-2" });
    (mockPrisma.crm_Leads.create as jest.Mock).mockResolvedValue({
      id: "lead-1",
      assigned_to: "user-2",
      accountsIDs: "account-1",
    });

    await tool("crm_create_lead").handler(
      {
        lastName: "Lead",
        email: "lead@example.com",
        assigned_to: "user-2",
        account_id: "account-1",
      },
      "user-1",
    );

    expect(mockPrisma.users.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: "user-1" },
      select: { id: true, role: true },
    });
    expect(mockPrisma.users.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: "user-2" },
      select: { id: true },
    });
    expect(mockPrisma.crm_Leads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assigned_to: "user-2",
        accountsIDs: "account-1",
        createdBy: "user-1",
        updatedBy: "user-1",
      }),
    });
  });

  it("rejects assigning a lead to another user for non-manager MCP users", async () => {
    (mockPrisma.users.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      role: "user",
    });

    await expect(
      tool("crm_create_lead").handler(
        {
          lastName: "Lead",
          assigned_to: "user-2",
        },
        "user-1",
      ),
    ).rejects.toThrow("NOT_FOUND");

    expect(mockPrisma.crm_Leads.create).not.toHaveBeenCalled();
  });

  it("dry-runs lead import with duplicate detection", async () => {
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([
      {
        id: "existing-1",
        assigned_to: "user-1",
        email: "same@example.com",
        company: null,
        phone: null,
      },
    ]);

    const result = await tool("crm_import_leads").handler(
      {
        leads: [
          { lastName: "One", email: "same@example.com" },
          { lastName: "Two", email: "two@example.com" },
        ],
        dryRun: true,
        dedupe_keys: ["email"],
      },
      "user-1",
    );

    expect(result.data).toEqual({
      dryRun: true,
      requested: 2,
      wouldCreate: 1,
      duplicates: [
        {
          index: 0,
          lead: { lastName: "One", email: "same@example.com" },
          key: "email:same@example.com",
          duplicate: true,
        },
      ],
    });
    expect(mockPrisma.crm_Leads.create).not.toHaveBeenCalled();
  });

  it("uses case-insensitive filters for import dedupe lookups", async () => {
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([
      {
        id: "existing-1",
        assigned_to: "user-1",
        email: "Same@Example.com",
        company: "ACME Services",
        phone: null,
      },
    ]);

    await tool("crm_import_leads").handler(
      {
        leads: [
          {
            lastName: "One",
            email: "same@example.com",
            company: "acme services",
          },
        ],
        dryRun: true,
        dedupe_keys: ["email"],
      },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.findMany).toHaveBeenCalledWith({
      where: {
        assigned_to: { in: ["user-1"] },
        deletedAt: null,
        OR: [
          { email: { equals: "same@example.com", mode: "insensitive" } },
          { company: { equals: "acme services", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        assigned_to: true,
        email: true,
        company: true,
        phone: true,
      },
    });
  });

  it("dedupes imported leads against their effective assignee", async () => {
    (mockPrisma.users.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user-1", role: "admin" })
      .mockResolvedValueOnce({ id: "user-2" });
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([
      {
        id: "existing-1",
        assigned_to: "user-2",
        email: "same@example.com",
        company: null,
        phone: null,
      },
    ]);

    const result = await tool("crm_import_leads").handler(
      {
        leads: [
          {
            lastName: "One",
            email: "same@example.com",
            assigned_to: "user-2",
          },
        ],
        dryRun: true,
        dedupe_keys: ["email"],
      },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assigned_to: { in: ["user-2"] },
        }),
      }),
    );
    expect(result.data.duplicates).toEqual([
      {
        index: 0,
        lead: {
          lastName: "One",
          email: "same@example.com",
          assigned_to: "user-2",
        },
        key: "email:same@example.com",
        duplicate: true,
      },
    ]);
  });

  it("imports new leads and attaches them to a segment", async () => {
    (mockPrisma.crm_Lead_Segments.findFirst as jest.Mock).mockResolvedValue({
      id: "segment-1",
    });
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.crm_Leads.create as jest.Mock)
      .mockResolvedValueOnce({ id: "lead-1" })
      .mockResolvedValueOnce({ id: "lead-2" });

    const result = await tool("crm_import_leads").handler(
      {
        leads: [
          { lastName: "One", email: "one@example.com" },
          { lastName: "Two", email: "two@example.com" },
        ],
        segment_id: "segment-1",
        import_batch_id: "00000000-0000-0000-0000-000000000001",
        dryRun: false,
        dedupe_keys: ["email"],
      },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.crm_LeadSegmentMembers.createMany).toHaveBeenCalledWith({
      data: [
        {
          lead_id: "lead-1",
          segment_id: "segment-1",
          import_batch_id: "00000000-0000-0000-0000-000000000001",
          status: "imported",
        },
        {
          lead_id: "lead-2",
          segment_id: "segment-1",
          import_batch_id: "00000000-0000-0000-0000-000000000001",
          status: "imported",
        },
      ],
      skipDuplicates: true,
    });
    expect(result.data).toEqual({
      requested: 2,
      created: 2,
      duplicateCount: 0,
      createdLeadIds: ["lead-1", "lead-2"],
    });
  });

  it("applies an import source to imported leads without per-lead source", async () => {
    (mockPrisma.crm_Lead_Sources.findFirst as jest.Mock).mockResolvedValue({
      id: "source-scrape",
    });
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.crm_Leads.create as jest.Mock).mockResolvedValue({ id: "lead-1" });

    await tool("crm_import_leads").handler(
      {
        leads: [{ lastName: "One", email: "one@example.com" }],
        source: "Scrape",
        dryRun: false,
        dedupe_keys: ["email"],
      },
      "user-1",
    );

    expect(mockPrisma.crm_Lead_Sources.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "Scrape", mode: "insensitive" } },
      select: { id: true },
    });
    expect(mockPrisma.crm_Leads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lead_source_id: "source-scrape",
        assigned_to: "user-1",
      }),
    });
  });

  it("assigns imported leads to the authenticated MCP user", async () => {
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.crm_Leads.create as jest.Mock).mockResolvedValue({ id: "lead-1" });

    await tool("crm_import_leads").handler(
      {
        leads: [{ lastName: "One", email: "one@example.com" }],
        dryRun: false,
        dedupe_keys: ["email"],
      },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assigned_to: "user-1",
        createdBy: "user-1",
        updatedBy: "user-1",
      }),
    });
  });

  it("converts an assigned lead into an opportunity and stores traceability", async () => {
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue({
      id: "lead-1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines LLC",
      description: "Potential build",
      accountsIDs: "account-1",
      lead_status_id: "status-new",
      converted_opportunity_id: null,
    });
    (mockPrisma.crm_Lead_Statuses.findFirst as jest.Mock).mockResolvedValue({
      id: "status-converted",
    });
    (mockPrisma.crm_Opportunities.create as jest.Mock).mockResolvedValue({
      id: "opportunity-1",
      name: "Analytical Engines LLC",
    });
    (mockPrisma.crm_Leads.update as jest.Mock).mockResolvedValue({
      id: "lead-1",
      converted_opportunity_id: "opportunity-1",
      lead_status_id: "status-converted",
    });

    const result = await tool("crm_convert_lead_to_opportunity").handler(
      { id: "lead-1", next_step: "Schedule scoping call" },
      "user-1",
    );

    expect(mockPrisma.crm_Opportunities.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Analytical Engines LLC",
        description: "Potential build",
        next_step: "Schedule scoping call",
        account: "account-1",
        assigned_to: "user-1",
        createdBy: "user-1",
      }),
    });
    expect(mockPrisma.crm_Leads.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: {
        converted_opportunity_id: "opportunity-1",
        lead_status_id: "status-converted",
        updatedBy: "user-1",
      },
    });
    expect(mockPrisma.crm_AuditLog.createMany).toHaveBeenCalled();
    expect(result.data.opportunity.id).toBe("opportunity-1");
  });
});
