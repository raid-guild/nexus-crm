import { crmLeadPilotTools, crmLeadTools } from "@/lib/mcp/tools/crm-leads";
import { prismadb } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { inngest } from "@/inngest/client";

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
jest.mock("@/lib/audit-log", () => ({
  diffObjects: jest.fn().mockReturnValue([]),
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/inngest/client", () => ({
  inngest: { send: jest.fn().mockResolvedValue({}) },
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
    (mockPrisma.users.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      role: "user",
    });
  });

  it("lists every non-deleted lead for an admin", async () => {
    (mockPrisma.users.findUnique as jest.Mock).mockResolvedValue({
      id: "admin-1",
      role: "admin",
    });
    (mockPrisma.crm_Leads.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.crm_Leads.count as jest.Mock).mockResolvedValue(0);

    await tool("crm_list_leads").handler({ limit: 20, offset: 0 }, "admin-1");

    expect(mockPrisma.crm_Leads.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
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
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue({
      id: "lead-1",
    });
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
      where: expect.objectContaining({
        id: "lead-1",
        deletedAt: null,
        OR: expect.any(Array),
      }),
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
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "lead",
        entityId: "lead-1",
        action: "updated",
        userId: "user-1",
      }),
    );
    expect(inngest.send).toHaveBeenCalledWith({
      name: "crm/lead.saved",
      data: { record_id: "lead-1" },
    });
    expect(result.data.lead_status.name).toBe("Follow Up");
  });

  it("clears an assigned lead status when lead_status_id is null", async () => {
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue({
      id: "lead-1",
    });
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
    expect(writeAuditLog).toHaveBeenCalledWith({
      entityType: "lead",
      entityId: "lead-1",
      action: "created",
      changes: null,
      userId: "user-1",
    });
    expect(inngest.send).toHaveBeenCalledWith({
      name: "crm/lead.saved",
      data: { record_id: "lead-1" },
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

  it("updates an assigned lead probability score", async () => {
    (mockPrisma.crm_Leads.findFirst as jest.Mock).mockResolvedValue({
      id: "lead-1",
      assigned_to: "user-1",
    });
    (mockPrisma.crm_Leads.update as jest.Mock).mockResolvedValue({
      id: "lead-1",
      probability_score: 80,
    });

    const result = await tool("crm_update_lead").handler(
      { id: "lead-1", probability_score: 80 },
      "user-1",
    );

    expect(mockPrisma.crm_Leads.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: expect.objectContaining({
        probability_score: 80,
        updatedBy: "user-1",
      }),
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "lead",
        entityId: "lead-1",
        action: "updated",
        userId: "user-1",
      }),
    );
    expect(inngest.send).toHaveBeenCalledWith({
      name: "crm/lead.saved",
      data: { record_id: "lead-1" },
    });
    expect(result.data.probability_score).toBe(80);
  });

  it("rejects invalid lead probability scores in MCP schemas", () => {
    expect(() =>
      tool("crm_update_lead").schema.parse({
        id: "00000000-0000-0000-0000-000000000001",
        probability_score: 101,
      }),
    ).toThrow();
    expect(() =>
      tool("crm_create_lead").schema.parse({
        lastName: "Lead",
        probability_score: 0,
      }),
    ).not.toThrow();
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
          { lastName: "One", email: "one@example.com", probability_score: 35 },
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
    expect(mockPrisma.crm_Leads.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        probability_score: 35,
      }),
    });
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
    (mockPrisma.crm_Leads.create as jest.Mock).mockResolvedValue({
      id: "lead-1",
    });

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
    (mockPrisma.crm_Leads.create as jest.Mock).mockResolvedValue({
      id: "lead-1",
    });

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

describe("BD Agent lead pilot tool surface", () => {
  const uuid = "00000000-0000-4000-8000-000000000001";

  it("exposes exactly the nine approved lead tools", () => {
    expect(crmLeadPilotTools.map((entry) => entry.name)).toEqual([
      "crm_list_lead_sources",
      "crm_list_lead_statuses",
      "crm_list_lead_types",
      "crm_list_leads",
      "crm_get_lead",
      "crm_search_leads",
      "crm_create_lead",
      "crm_update_lead",
      "crm_update_lead_status",
    ]);
  });

  it("rejects ownership, status, and account changes through generic update", () => {
    const updateTool = crmLeadPilotTools.find(
      (entry) => entry.name === "crm_update_lead",
    );
    if (!updateTool) throw new Error("Pilot update tool not found");

    for (const field of [
      "assigned_to",
      "lead_status_id",
      "account_id",
      "accountIDs",
    ]) {
      expect(
        updateTool.schema.safeParse({ id: uuid, [field]: uuid }).success,
      ).toBe(false);
    }
  });

  it("rejects ownership, status, and account fields during pilot creation", () => {
    const createTool = crmLeadPilotTools.find(
      (entry) => entry.name === "crm_create_lead",
    );
    if (!createTool) throw new Error("Pilot create tool not found");

    for (const field of [
      "assigned_to",
      "lead_status_id",
      "account_id",
      "accountIDs",
    ]) {
      expect(
        createTool.schema.safeParse({ lastName: "Lead", [field]: uuid })
          .success,
      ).toBe(false);
    }
  });

  it("requires an exact status name instead of a database status ID", () => {
    const statusTool = crmLeadPilotTools.find(
      (entry) => entry.name === "crm_update_lead_status",
    );
    if (!statusTool) throw new Error("Pilot status tool not found");

    expect(statusTool.description).toBe(
      "Update a lead available to the authenticated user using an exact configured lead_status_name.",
    );
    expect(statusTool.description).not.toContain("lead_status_id");
    expect(statusTool.description).not.toContain("null");
    expect(
      statusTool.schema.safeParse({ id: uuid, lead_status_id: uuid }).success,
    ).toBe(false);
    expect(
      statusTool.schema.safeParse({ id: uuid, lead_status_name: "Follow Up" })
        .success,
    ).toBe(true);
  });
});
