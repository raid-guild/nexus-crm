import type { AuthzUser } from "@/lib/authz";
import { filterAuthorizedLeadIds, isManagerOrAdmin } from "@/lib/authz";
import { prismadb } from "@/lib/prisma";

export type LeadSegmentOption = {
  id: string;
  name: string;
};

export async function getManageableLeadSegmentsForUser(
  user: AuthzUser
): Promise<LeadSegmentOption[]> {
  const segments = await prismadb.crm_Lead_Segments.findMany({
    where: {
      deletedAt: null,
      ...(isManagerOrAdmin(user) ? {} : { createdBy: user.id }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return segments;
}

export async function assertManageableLeadSegmentIds(
  user: AuthzUser,
  segmentIds: string[]
) {
  const uniqueSegmentIds = Array.from(new Set(segmentIds.filter(Boolean)));
  if (uniqueSegmentIds.length === 0) return [];

  const allowedSegments = await prismadb.crm_Lead_Segments.findMany({
    where: {
      id: { in: uniqueSegmentIds },
      deletedAt: null,
      ...(isManagerOrAdmin(user) ? {} : { createdBy: user.id }),
    },
    select: { id: true },
  });
  const allowedSegmentIds = allowedSegments.map(
    (segment: { id: string }) => segment.id
  );

  if (allowedSegmentIds.length !== uniqueSegmentIds.length) {
    throw new Error("LEAD_SEGMENT_NOT_FOUND");
  }

  return allowedSegmentIds;
}

export async function setLeadSegmentsForUser(
  user: AuthzUser,
  leadId: string,
  segmentIds: string[]
) {
  const targetSegmentIds = await assertManageableLeadSegmentIds(user, segmentIds);
  const manageableSegmentIds = (
    await getManageableLeadSegmentsForUser(user)
  ).map((segment: { id: string }) => segment.id);
  const operations: any[] = [
    prismadb.crm_LeadSegmentMembers.deleteMany({
      where: {
        lead_id: leadId,
        segment_id: {
          in: manageableSegmentIds,
          notIn: targetSegmentIds,
        },
      },
    }),
  ];

  if (targetSegmentIds.length > 0) {
    operations.push(prismadb.crm_LeadSegmentMembers.createMany({
      data: targetSegmentIds.map((segmentId: string) => ({
        lead_id: leadId,
        segment_id: segmentId,
      })),
      skipDuplicates: true,
    }));
  }

  await prismadb.$transaction(operations);
}

export async function addLeadsToSegmentForUser(
  user: AuthzUser,
  leadIds: string[],
  segmentId: string
) {
  const [allowedSegmentId] = await assertManageableLeadSegmentIds(user, [
    segmentId,
  ]);
  const uniqueLeadIds = Array.from(new Set(leadIds.filter(Boolean)));
  const authorizedLeadIds = await filterAuthorizedLeadIds(user, uniqueLeadIds);

  if (authorizedLeadIds.length !== uniqueLeadIds.length) {
    throw new Error("LEAD_NOT_FOUND");
  }

  const result = await prismadb.crm_LeadSegmentMembers.createMany({
    data: authorizedLeadIds.map((leadId) => ({
      lead_id: leadId,
      segment_id: allowedSegmentId,
    })),
    skipDuplicates: true,
  });

  return {
    requested: uniqueLeadIds.length,
    added: result.count,
  };
}
