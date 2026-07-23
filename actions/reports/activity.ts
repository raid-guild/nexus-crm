import { prismadb } from "@/lib/prisma";
import type { ReportFilters, ChartDataPoint } from "./types";
import { groupedToChartData } from "./types";
import type { ReportScope } from "@/lib/authz/scopes/report-scope";
import { getReportScope } from "@/lib/authz/scopes/report-scope";

const DEFAULT_SCOPE: ReportScope = getReportScope({ id: "", role: "manager" });
const RECENT_ACTIVITY_LIMIT = 25;

type SupportedEntityType =
  | "lead"
  | "contact"
  | "account"
  | "opportunity"
  | "contract";

export type RecentActivity = {
  id: string;
  type: "call" | "meeting" | "note" | "email";
  title: string;
  description: string | null;
  date: Date;
  status: "scheduled" | "completed" | "cancelled";
  createdByName: string;
  linkedEntities: Array<{
    type: string;
    id: string;
    name: string;
    href: string | null;
  }>;
};

const ENTITY_CONFIG: Record<
  SupportedEntityType,
  {
    model: string;
    slug: string;
    scopeKey?: keyof Pick<ReportScope, "lead" | "contact" | "account" | "opportunity">;
    select: Record<string, boolean>;
    getName: (record: Record<string, string | null>) => string;
  }
> = {
  lead: {
    model: "crm_Leads",
    slug: "leads",
    scopeKey: "lead",
    select: { id: true, firstName: true, lastName: true, company: true },
    getName: (record) =>
      [record.firstName, record.lastName].filter(Boolean).join(" ") ||
      record.company ||
      "Unnamed lead",
  },
  contact: {
    model: "crm_Contacts",
    slug: "contacts",
    scopeKey: "contact",
    select: { id: true, first_name: true, last_name: true },
    getName: (record) =>
      [record.first_name, record.last_name].filter(Boolean).join(" ") ||
      "Unnamed contact",
  },
  account: {
    model: "crm_Accounts",
    slug: "accounts",
    scopeKey: "account",
    select: { id: true, name: true },
    getName: (record) => record.name || "Unnamed account",
  },
  opportunity: {
    model: "crm_Opportunities",
    slug: "opportunities",
    scopeKey: "opportunity",
    select: { id: true, name: true },
    getName: (record) => record.name || "Unnamed opportunity",
  },
  contract: {
    model: "crm_Contracts",
    slug: "contracts",
    select: { id: true, title: true },
    getName: (record) => record.title || "Unnamed contract",
  },
};

const isSupportedEntityType = (value: string): value is SupportedEntityType =>
  value in ENTITY_CONFIG;

const fallbackEntityName = (entityType: string) =>
  entityType
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());

export async function getActivitiesByType(
  filters: ReportFilters,
  scope: ReportScope = DEFAULT_SCOPE,
): Promise<ChartDataPoint[]> {
  // crm_Activities has no direct ReportScope mapping yet.
  void scope;
  const activities = await prismadb.crm_Activities.findMany({
    where: {
      deletedAt: null,
      date: { gte: filters.dateFrom, lte: filters.dateTo },
    },
    select: { type: true },
  });
  const grouped: Record<string, number> = {};
  for (const a of activities) {
    grouped[a.type] = (grouped[a.type] || 0) + 1;
  }
  return groupedToChartData(grouped);
}

export async function getRecentActivities(
  filters: ReportFilters,
  scope: ReportScope = DEFAULT_SCOPE,
): Promise<RecentActivity[]> {
  const activities = await prismadb.crm_Activities.findMany({
    where: {
      deletedAt: null,
      date: { gte: filters.dateFrom, lte: filters.dateTo },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: RECENT_ACTIVITY_LIMIT,
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      date: true,
      status: true,
      created_by_user: { select: { id: true, name: true, avatar: true } },
      links: { select: { id: true, entityType: true, entityId: true } },
    },
  });

  const idsByEntityType = new Map<SupportedEntityType, Set<string>>();
  for (const activity of activities) {
    for (const link of activity.links) {
      if (!isSupportedEntityType(link.entityType)) continue;
      const ids = idsByEntityType.get(link.entityType) ?? new Set<string>();
      ids.add(link.entityId);
      idsByEntityType.set(link.entityType, ids);
    }
  }

  const entityNames = new Map<string, string>();
  await Promise.all(
    Array.from(idsByEntityType, async ([entityType, entityIds]) => {
      const config = ENTITY_CONFIG[entityType];
      const scopeFilter = config.scopeKey ? scope[config.scopeKey] : {};
      const records = await (prismadb as any)[config.model].findMany({
        where: { id: { in: Array.from(entityIds) }, deletedAt: null, ...scopeFilter },
        select: config.select,
      });

      for (const record of records as Array<Record<string, string | null>>) {
        entityNames.set(`${entityType}:${record.id}`, config.getName(record));
      }
    }),
  );

  return activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    title: activity.title,
    description: activity.description,
    date: activity.date,
    status: activity.status,
    createdByName: activity.created_by_user?.name || "Unknown user",
    linkedEntities: activity.links.map((link) => {
      const config = isSupportedEntityType(link.entityType)
        ? ENTITY_CONFIG[link.entityType]
        : null;
      return {
        type: link.entityType,
        id: link.entityId,
        name:
          entityNames.get(`${link.entityType}:${link.entityId}`) ||
          fallbackEntityName(link.entityType),
        href: config ? `/crm/${config.slug}/${link.entityId}` : null,
      };
    }),
  }));
}
