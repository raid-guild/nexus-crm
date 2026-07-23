import { prismadb } from "@/lib/prisma";

export const getActivitiesCount = async () =>
  prismadb.crm_Activities.count({ where: { deletedAt: null } });
