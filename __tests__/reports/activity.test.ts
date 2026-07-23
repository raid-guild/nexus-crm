jest.mock("@/lib/prisma", () => ({
  prismadb: {
    crm_Activities: { findMany: jest.fn() },
    crm_Leads: { findMany: jest.fn() },
    crm_Contacts: { findMany: jest.fn() },
    crm_Accounts: { findMany: jest.fn() },
    crm_Opportunities: { findMany: jest.fn() },
    crm_Contracts: { findMany: jest.fn() },
  },
}));

import { prismadb } from "@/lib/prisma";
import {
  getActivitiesByType,
  getRecentActivities,
} from "@/actions/reports/activity";
import type { ReportFilters } from "@/actions/reports/types";

const baseFilters: ReportFilters = { dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") };

describe("activity report actions", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getActivitiesByType", () => {
    it("groups activities by type", async () => {
      (prismadb.crm_Activities.findMany as jest.Mock).mockResolvedValue([
        { type: "call" }, { type: "call" }, { type: "meeting" }, { type: "email" },
      ]);
      const result = await getActivitiesByType(baseFilters);
      expect(result).toEqual([{ name: "call", Number: 2 }, { name: "meeting", Number: 1 }, { name: "email", Number: 1 }]);
    });
  });

  describe("getRecentActivities", () => {
    it("returns newest touchpoints with readable linked CRM records", async () => {
      const activityDate = new Date("2025-08-15T14:00:00.000Z");
      (prismadb.crm_Activities.findMany as jest.Mock).mockResolvedValue([
        {
          id: "activity-1",
          type: "call",
          title: "Discovery call",
          description: "Discussed the rollout plan",
          date: activityDate,
          status: "completed",
          created_by_user: { id: "user-1", name: "Alice", avatar: null },
          links: [
            { id: "link-1", entityType: "lead", entityId: "lead-1" },
            { id: "link-2", entityType: "account", entityId: "account-1" },
          ],
        },
      ]);
      (prismadb.crm_Leads.findMany as jest.Mock).mockResolvedValue([
        { id: "lead-1", firstName: "Jordan", lastName: "Lee", company: "Acme" },
      ]);
      (prismadb.crm_Accounts.findMany as jest.Mock).mockResolvedValue([
        { id: "account-1", name: "Acme" },
      ]);

      const result = await getRecentActivities(baseFilters);

      expect(prismadb.crm_Activities.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, date: { gte: baseFilters.dateFrom, lte: baseFilters.dateTo } },
          orderBy: [{ date: "desc" }, { id: "desc" }],
          take: 25,
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: "activity-1",
          date: activityDate,
          createdByName: "Alice",
          linkedEntities: [
            { type: "lead", id: "lead-1", name: "Jordan Lee", href: "/crm/leads/lead-1" },
            { type: "account", id: "account-1", name: "Acme", href: "/crm/accounts/account-1" },
          ],
        }),
      ]);
    });

    it("keeps an informative fallback for unsupported linked entity types", async () => {
      (prismadb.crm_Activities.findMany as jest.Mock).mockResolvedValue([
        {
          id: "activity-2",
          type: "note",
          title: "General note",
          description: null,
          date: new Date("2025-08-14T14:00:00.000Z"),
          status: "completed",
          created_by_user: null,
          links: [{ id: "link-3", entityType: "project", entityId: "project-1" }],
        },
      ]);

      const result = await getRecentActivities(baseFilters);

      expect(result[0].createdByName).toBe("Unknown user");
      expect(result[0].linkedEntities).toEqual([
        { type: "project", id: "project-1", name: "Project", href: null },
      ]);
    });
  });
});
