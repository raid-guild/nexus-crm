import { z } from "zod";
import { prismadb } from "@/lib/prisma";
import {
  paginationSchema,
  paginationArgs,
  conflict,
  listResponse,
  itemResponse,
  ilike,
  notFound,
  softDeleteData,
  validationError,
} from "../helpers";

const PREFERRED_LEAD_STATUS_ORDER = [
  "New",
  "Researching",
  "Cold Outreach",
  "Contacted",
  "Follow Up",
  "Qualified",
  "Converted to Opportunity",
  "Nurture",
  "Lost",
];

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function sortLeadStatuses<T extends { name: string }>(statuses: T[]): T[] {
  const order = new Map(
    PREFERRED_LEAD_STATUS_ORDER.map((name, index) => [
      normalizeName(name),
      index,
    ])
  );

  return [...statuses].sort((a, b) => {
    const aOrder = order.get(normalizeName(a.name));
    const bOrder = order.get(normalizeName(b.name));

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    return a.name.localeCompare(b.name);
  });
}

const leadFieldSchema = {
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  description: z.string().optional(),
  lead_source_id: z.string().uuid().optional(),
  lead_status_id: z.string().uuid().nullable().optional(),
  lead_type_id: z.string().uuid().optional(),
  refered_by: z.string().optional(),
  campaign: z.string().optional(),
  accountIDs: z.string().uuid().optional(),
};

async function listConfigValues(model: {
  findMany: (args: { select: { id: true; name: true }; orderBy: { name: "asc" } }) => Promise<{ id: string; name: string }[]>;
}) {
  const values = await model.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return listResponse(values, values.length, 0);
}

function dedupeKeyForLead(
  lead: { email?: string | null; company?: string | null; phone?: string | null },
  keys: string[]
) {
  return keys
    .map((key) => {
      const value = lead[key as keyof typeof lead];
      return value ? `${key}:${value.trim().toLowerCase()}` : null;
    })
    .filter(Boolean)
    .join("|");
}

function exactInsensitive(field: "email" | "company" | "phone", value: string) {
  return { [field]: { equals: value, mode: "insensitive" as const } };
}

export const crmLeadTools = [
  {
    name: "crm_list_lead_sources",
    description: "List available CRM lead sources",
    schema: z.object({}),
    async handler() {
      return listConfigValues(prismadb.crm_Lead_Sources);
    },
  },
  {
    name: "crm_list_lead_statuses",
    description:
      "List available CRM lead statuses for moving leads across the Kanban board",
    schema: z.object({}),
    async handler(_args: Record<string, never>) {
      const statuses = await prismadb.crm_Lead_Statuses.findMany({
        select: { id: true, name: true },
      });

      return listResponse(sortLeadStatuses(statuses), statuses.length, 0);
    },
  },
  {
    name: "crm_list_lead_types",
    description: "List available CRM lead types",
    schema: z.object({}),
    async handler() {
      return listConfigValues(prismadb.crm_Lead_Types);
    },
  },
  {
    name: "crm_list_leads",
    description:
      "List CRM leads assigned to the authenticated user. Optionally filter by segment, source, status, or type.",
    schema: z.object({
      ...paginationSchema,
      segment_id: z.string().uuid().optional(),
      lead_source_id: z.string().uuid().optional(),
      lead_status_id: z.string().uuid().nullable().optional(),
      lead_type_id: z.string().uuid().optional(),
    }),
    async handler(
      args: {
        limit: number;
        offset: number;
        segment_id?: string;
        lead_source_id?: string;
        lead_status_id?: string | null;
        lead_type_id?: string;
      },
      userId: string
    ) {
      const where: any = {
        assigned_to: userId,
        deletedAt: null,
        ...(args.lead_source_id ? { lead_source_id: args.lead_source_id } : {}),
        ...(Object.prototype.hasOwnProperty.call(args, "lead_status_id")
          ? { lead_status_id: args.lead_status_id }
          : {}),
        ...(args.lead_type_id ? { lead_type_id: args.lead_type_id } : {}),
        ...(args.segment_id
          ? { segments: { some: { segment_id: args.segment_id } } }
          : {}),
      };
      const [data, total] = await Promise.all([
        prismadb.crm_Leads.findMany({
          where,
          include: {
            lead_source: { select: { id: true, name: true } },
            lead_status: { select: { id: true, name: true } },
            lead_type: { select: { id: true, name: true } },
            segments: {
              include: {
                segment: { select: { id: true, name: true } },
              },
            },
          },
          ...paginationArgs(args),
          orderBy: { createdAt: "desc" },
        }),
        prismadb.crm_Leads.count({ where }),
      ]);
      return listResponse(data, total, args.offset);
    },
  },
  {
    name: "crm_get_lead",
    description: "Get a single CRM lead by ID",
    schema: z.object({ id: z.string().uuid() }),
    async handler(args: { id: string }, userId: string) {
      const lead = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!lead) notFound("Lead");
      return itemResponse(lead);
    },
  },
  {
    name: "crm_search_leads",
    description: "Search leads by name, company, or email (substring match)",
    schema: z.object({ query: z.string().min(1), ...paginationSchema }),
    async handler(
      args: { query: string; limit: number; offset: number },
      userId: string
    ) {
      const where = {
        assigned_to: userId,
        deletedAt: null,
        OR: [
          ilike("firstName", args.query),
          ilike("lastName", args.query),
          ilike("email", args.query),
          ilike("company", args.query),
        ],
      };
      const [data, total] = await Promise.all([
        prismadb.crm_Leads.findMany({
          where,
          ...paginationArgs(args),
          orderBy: { createdAt: "desc" },
        }),
        prismadb.crm_Leads.count({ where }),
      ]);
      return listResponse(data, total, args.offset);
    },
  },
  {
    name: "crm_create_lead",
    description: "Create a new CRM lead",
    schema: z.object({
      ...leadFieldSchema,
      lastName: z.string().min(1),
    }),
    async handler(
      args: {
        firstName?: string;
        lastName: string;
        email?: string;
        company?: string;
        phone?: string;
        jobTitle?: string;
        description?: string;
        lead_source_id?: string;
        lead_status_id?: string | null;
        lead_type_id?: string;
        refered_by?: string;
        campaign?: string;
        accountIDs?: string;
      },
      userId: string
    ) {
      const { lastName, accountIDs, ...rest } = args;
      const lead = await prismadb.crm_Leads.create({
        data: {
          v: 0,
          lastName,
          ...rest,
          assigned_to: userId,
          accountsIDs: accountIDs,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      return itemResponse(lead);
    },
  },
  {
    name: "crm_update_lead",
    description: "Update an existing CRM lead by ID",
    schema: z.object({
      id: z.string().uuid(),
      ...leadFieldSchema,
    }),
    async handler(
      args: {
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        company?: string;
        phone?: string;
        jobTitle?: string;
        description?: string;
        lead_source_id?: string;
        lead_status_id?: string | null;
        lead_type_id?: string;
        refered_by?: string;
        campaign?: string;
        accountIDs?: string;
      },
      userId: string
    ) {
      const existing = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!existing) notFound("Lead");
      const { id, accountIDs, ...updateData } = args;
      const lead = await prismadb.crm_Leads.update({
        where: { id },
        data: { ...updateData, accountsIDs: accountIDs, updatedBy: userId },
      });
      return itemResponse(lead);
    },
  },
  {
    name: "crm_update_lead_status",
    description:
      "Move one of the authenticated user's leads to a lead status by ID or exact status name. Pass lead_status_id null to clear the status.",
    schema: z.object({
      id: z.string().uuid(),
      lead_status_id: z.string().uuid().nullable().optional(),
      lead_status_name: z.string().min(1).optional(),
    }),
    async handler(
      args: {
        id: string;
        lead_status_id?: string | null;
        lead_status_name?: string;
      },
      userId: string
    ) {
      const existing = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!existing) notFound("Lead");

      const hasStatusId = Object.prototype.hasOwnProperty.call(
        args,
        "lead_status_id"
      );
      const hasStatusName = Boolean(args.lead_status_name?.trim());
      if (hasStatusId && hasStatusName) {
        validationError("Provide either lead_status_id or lead_status_name, not both");
      }
      if (!hasStatusId && !hasStatusName) {
        validationError("Provide lead_status_id, lead_status_name, or lead_status_id null");
      }

      let nextStatusId: string | null = args.lead_status_id ?? null;

      if (hasStatusName) {
        const statusName = args.lead_status_name?.trim();
        const status = await prismadb.crm_Lead_Statuses.findFirst({
          where: { name: { equals: statusName, mode: "insensitive" } },
          select: { id: true },
        });
        if (!status) notFound("Lead status");
        nextStatusId = status.id;
      } else if (nextStatusId) {
        const status = await prismadb.crm_Lead_Statuses.findUnique({
          where: { id: nextStatusId },
          select: { id: true },
        });
        if (!status) notFound("Lead status");
      }

      const lead = await prismadb.crm_Leads.update({
        where: { id: args.id },
        data: { lead_status_id: nextStatusId, updatedBy: userId },
        include: {
          lead_status: { select: { id: true, name: true } },
        },
      });

      return itemResponse(lead);
    },
  },
  {
    name: "crm_import_leads",
    description:
      "Bulk import assigned leads with optional dry-run, dedupe checks, segment membership, and source/status/type fields.",
    schema: z.object({
      leads: z.array(z.object({
        ...leadFieldSchema,
        lastName: z.string().min(1),
      })).min(1).max(500),
      segment_id: z.string().uuid().optional(),
      import_batch_id: z.string().uuid().optional(),
      dryRun: z.boolean().default(false),
      dedupe_keys: z.array(z.enum(["email", "company", "phone"])).default(["email"]),
    }),
    async handler(
      args: {
        leads: Array<{
          firstName?: string;
          lastName: string;
          email?: string;
          company?: string;
          phone?: string;
          jobTitle?: string;
          description?: string;
          lead_source_id?: string;
          lead_status_id?: string | null;
          lead_type_id?: string;
          refered_by?: string;
          campaign?: string;
          accountIDs?: string;
        }>;
        segment_id?: string;
        import_batch_id?: string;
        dryRun: boolean;
        dedupe_keys: Array<"email" | "company" | "phone">;
      },
      userId: string
    ) {
      if (args.segment_id) {
        const segment = await prismadb.crm_Lead_Segments.findFirst({
          where: { id: args.segment_id, createdBy: userId, deletedAt: null },
          select: { id: true },
        });
        if (!segment) notFound("Lead segment");
      }

      const dedupeFilters = [
        ...args.leads
          .filter((lead) => lead.email)
          .map((lead) => exactInsensitive("email", lead.email as string)),
        ...args.leads
          .filter((lead) => lead.company)
          .map((lead) => exactInsensitive("company", lead.company as string)),
        ...args.leads
          .filter((lead) => lead.phone)
          .map((lead) => exactInsensitive("phone", lead.phone as string)),
      ];

      const existing = dedupeFilters.length
        ? await prismadb.crm_Leads.findMany({
            where: {
              assigned_to: userId,
              deletedAt: null,
              OR: dedupeFilters,
            },
            select: { id: true, email: true, company: true, phone: true },
          })
        : [];
      const existingKeys = new Set(
        existing.map((lead) => dedupeKeyForLead(lead, args.dedupe_keys))
      );

      const seenImportKeys = new Set<string>();
      const candidates = args.leads.map((lead, index) => {
        const key = dedupeKeyForLead(lead, args.dedupe_keys);
        const duplicate = Boolean(key && (existingKeys.has(key) || seenImportKeys.has(key)));
        if (key) seenImportKeys.add(key);
        return { index, lead, key, duplicate };
      });

      if (args.dryRun) {
        return itemResponse({
          dryRun: true,
          requested: args.leads.length,
          wouldCreate: candidates.filter((candidate) => !candidate.duplicate).length,
          duplicates: candidates.filter((candidate) => candidate.duplicate),
        });
      }

      const created = [];
      for (const candidate of candidates) {
        if (candidate.duplicate) continue;
        const { accountIDs, ...leadData } = candidate.lead;
        const lead = await prismadb.crm_Leads.create({
          data: {
            v: 0,
            ...leadData,
            assigned_to: userId,
            accountsIDs: accountIDs,
            createdBy: userId,
            updatedBy: userId,
          },
        });
        created.push(lead);
      }

      if (args.segment_id && created.length > 0) {
        await prismadb.crm_LeadSegmentMembers.createMany({
          data: created.map((lead) => ({
            lead_id: lead.id,
            segment_id: args.segment_id as string,
            import_batch_id: args.import_batch_id,
            status: "imported",
          })),
          skipDuplicates: true,
        });
      }

      return itemResponse({
        requested: args.leads.length,
        created: created.length,
        duplicateCount: candidates.filter((candidate) => candidate.duplicate).length,
        createdLeadIds: created.map((lead) => lead.id),
      });
    },
  },
  {
    name: "crm_convert_lead_to_opportunity",
    description:
      "Convert one of the authenticated user's assigned leads into an opportunity and store conversion traceability on the lead.",
    schema: z.object({
      id: z.string().uuid(),
      opportunity_name: z.string().min(1).optional(),
      description: z.string().optional(),
      next_step: z.string().optional(),
      budget: z.number().min(0).optional(),
      expected_revenue: z.number().min(0).optional(),
      currency: z.string().optional(),
      close_date: z.string().datetime().optional(),
      sales_stage: z.string().uuid().optional(),
      type: z.string().uuid().optional(),
    }),
    async handler(
      args: {
        id: string;
        opportunity_name?: string;
        description?: string;
        next_step?: string;
        budget?: number;
        expected_revenue?: number;
        currency?: string;
        close_date?: string;
        sales_stage?: string;
        type?: string;
      },
      userId: string
    ) {
      const lead = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!lead) notFound("Lead");
      if (lead.converted_opportunity_id) {
        conflict("Lead has already been converted to an opportunity");
      }

      const status = await prismadb.crm_Lead_Statuses.findFirst({
        where: { name: { equals: "Converted to Opportunity", mode: "insensitive" } },
        select: { id: true },
      });

      const opportunity = await prismadb.crm_Opportunities.create({
        data: {
          v: 0,
          name:
            args.opportunity_name ??
            lead.company ??
            [lead.firstName, lead.lastName].filter(Boolean).join(" "),
          description: args.description ?? lead.description ?? undefined,
          next_step: args.next_step,
          budget: args.budget,
          expected_revenue: args.expected_revenue,
          currency: args.currency,
          close_date: args.close_date ? new Date(args.close_date) : undefined,
          sales_stage: args.sales_stage,
          type: args.type,
          account: lead.accountsIDs,
          assigned_to: userId,
          createdBy: userId,
          updatedBy: userId,
          last_activity_by: userId,
          status: "ACTIVE",
        },
      });

      const updatedLead = await prismadb.crm_Leads.update({
        where: { id: lead.id },
        data: {
          converted_opportunity_id: opportunity.id,
          lead_status_id: status?.id ?? lead.lead_status_id,
          updatedBy: userId,
        },
      });

      await prismadb.crm_AuditLog.createMany({
        data: [
          {
            entityType: "opportunity",
            entityId: opportunity.id,
            action: "created",
            userId,
            changes: { convertedFromLeadId: lead.id },
          },
          {
            entityType: "lead",
            entityId: lead.id,
            action: "updated",
            userId,
            changes: {
              converted_opportunity_id: { old: null, new: opportunity.id },
            },
          },
        ],
      });

      return itemResponse({ lead: updatedLead, opportunity });
    },
  },
  {
    name: "crm_delete_lead",
    description: "Soft-delete a CRM lead by ID (sets deletedAt timestamp)",
    schema: z.object({ id: z.string().uuid() }),
    async handler(args: { id: string }, userId: string) {
      const existing = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!existing) notFound("Lead");
      const lead = await prismadb.crm_Leads.update({
        where: { id: args.id },
        data: softDeleteData(userId),
      });
      return itemResponse({ id: lead.id, deletedAt: lead.deletedAt });
    },
  },
];
