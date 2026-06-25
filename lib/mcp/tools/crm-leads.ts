import { z } from "zod";
import { prismadb } from "@/lib/prisma";
import {
  paginationSchema,
  paginationArgs,
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

export const crmLeadTools = [
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
    name: "crm_list_leads",
    description: "List CRM leads assigned to the authenticated user",
    schema: z.object({ ...paginationSchema }),
    async handler(args: { limit: number; offset: number }, userId: string) {
      const where = { assigned_to: userId, deletedAt: null };
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
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
    }),
    async handler(
      args: {
        firstName?: string;
        lastName: string;
        email?: string;
        company?: string;
        phone?: string;
        jobTitle?: string;
      },
      userId: string
    ) {
      const { lastName, ...rest } = args;
      const lead = await prismadb.crm_Leads.create({
        data: { v: 0, lastName, ...rest, assigned_to: userId, createdBy: userId },
      });
      return itemResponse(lead);
    },
  },
  {
    name: "crm_update_lead",
    description: "Update an existing CRM lead by ID",
    schema: z.object({
      id: z.string().uuid(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
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
      },
      userId: string
    ) {
      const existing = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!existing) notFound("Lead");
      const { id, ...updateData } = args;
      const lead = await prismadb.crm_Leads.update({
        where: { id },
        data: { ...updateData, updatedBy: userId },
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
