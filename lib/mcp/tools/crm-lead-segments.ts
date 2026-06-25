import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import {
  conflict,
  itemResponse,
  listResponse,
  notFound,
  paginationArgs,
  paginationSchema,
  validationError,
} from "../helpers";

const criteriaSchema = z.record(z.string(), z.unknown()).optional();

export const crmLeadSegmentTools = [
  {
    name: "crm_list_lead_segments",
    description:
      "List lead segments created by the authenticated user, with member counts.",
    schema: z.object({
      ...paginationSchema,
      query: z.string().min(1).optional(),
    }),
    async handler(
      args: { limit: number; offset: number; query?: string },
      userId: string
    ) {
      const where = {
        createdBy: userId,
        deletedAt: null,
        ...(args.query
          ? { name: { contains: args.query, mode: "insensitive" as const } }
          : {}),
      };

      const [data, total] = await Promise.all([
        prismadb.crm_Lead_Segments.findMany({
          where,
          include: { _count: { select: { members: true } } },
          ...paginationArgs(args),
          orderBy: { createdAt: "desc" },
        }),
        prismadb.crm_Lead_Segments.count({ where }),
      ]);

      return listResponse(
        data.map((segment) => ({
          id: segment.id,
          name: segment.name,
          description: segment.description,
          audience: segment.audience,
          region: segment.region,
          source: segment.source,
          criteria: segment.criteria,
          createdAt: segment.createdAt,
          updatedAt: segment.updatedAt,
          leadCount: segment._count.members,
        })),
        total,
        args.offset
      );
    },
  },
  {
    name: "crm_create_lead_segment",
    description:
      "Create a lead segment for a specific audience, list, scrape cohort, or outreach test.",
    schema: z.object({
      name: z.string().trim().min(1).max(160),
      description: z.string().trim().max(1000).optional(),
      audience: z.string().trim().max(160).optional(),
      region: z.string().trim().max(160).optional(),
      source: z.string().trim().max(160).optional(),
      criteria: criteriaSchema,
    }),
    async handler(
      args: {
        name: string;
        description?: string;
        audience?: string;
        region?: string;
        source?: string;
        criteria?: Record<string, unknown>;
      },
      userId: string
    ) {
      const existing = await prismadb.crm_Lead_Segments.findFirst({
        where: { name: args.name.trim(), createdBy: userId, deletedAt: null },
        select: { id: true },
      });
      if (existing) conflict("Lead segment already exists");

      const segment = await prismadb.crm_Lead_Segments.create({
        data: {
          v: 0,
          name: args.name.trim(),
          description: args.description?.trim() || undefined,
          audience: args.audience?.trim() || undefined,
          region: args.region?.trim() || undefined,
          source: args.source?.trim() || undefined,
          criteria: args.criteria as Prisma.InputJsonValue | undefined,
          createdBy: userId,
        },
      });

      return itemResponse(segment);
    },
  },
  {
    name: "crm_add_leads_to_segment",
    description:
      "Add assigned leads to a lead segment owned by the authenticated user.",
    schema: z.object({
      segment_id: z.string().uuid(),
      lead_ids: z.array(z.string().uuid()).min(1).max(500),
      import_batch_id: z.string().uuid().optional(),
      status: z.string().trim().max(80).optional(),
    }),
    async handler(
      args: {
        segment_id: string;
        lead_ids: string[];
        import_batch_id?: string;
        status?: string;
      },
      userId: string
    ) {
      const segment = await prismadb.crm_Lead_Segments.findFirst({
        where: { id: args.segment_id, createdBy: userId, deletedAt: null },
        select: { id: true },
      });
      if (!segment) notFound("Lead segment");

      const uniqueLeadIds = Array.from(new Set(args.lead_ids));
      const accessibleLeads = await prismadb.crm_Leads.findMany({
        where: {
          id: { in: uniqueLeadIds },
          assigned_to: userId,
          deletedAt: null,
        },
        select: { id: true },
      });

      const accessibleLeadIds = new Set(accessibleLeads.map((lead) => lead.id));
      const inaccessibleLeadIds = uniqueLeadIds.filter(
        (leadId) => !accessibleLeadIds.has(leadId)
      );

      if (inaccessibleLeadIds.length > 0) {
        validationError(
          `Some leads are not assigned to this user or do not exist: ${inaccessibleLeadIds.join(", ")}`
        );
      }

      const result = await prismadb.crm_LeadSegmentMembers.createMany({
        data: uniqueLeadIds.map((leadId) => ({
          lead_id: leadId,
          segment_id: args.segment_id,
          import_batch_id: args.import_batch_id,
          status: args.status?.trim() || undefined,
        })),
        skipDuplicates: true,
      });

      return itemResponse({
        segment_id: args.segment_id,
        requested: uniqueLeadIds.length,
        added: result.count,
      });
    },
  },
];
