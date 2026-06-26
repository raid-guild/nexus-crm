"use server";

import { revalidatePath } from "next/cache";

import {
  AuthenticationError,
  AuthorizationError,
  assertCanReadLead,
  requireAuthenticated,
} from "@/lib/authz";
import {
  addLeadsToSegmentForUser,
  getManageableLeadSegmentsForUser,
  setLeadSegmentsForUser,
} from "@/lib/crm/lead-segments";

export const getLeadSegments = async () => {
  try {
    const user = await requireAuthenticated();
    return await getManageableLeadSegmentsForUser(user);
  } catch (error) {
    if (error instanceof AuthenticationError) return [];
    throw error;
  }
};

export const updateLeadSegments = async (data: {
  leadId: string;
  segmentIds: string[];
}) => {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Unauthorized" };
    throw error;
  }

  try {
    await assertCanReadLead(user, data.leadId);
    await setLeadSegmentsForUser(user, data.leadId, data.segmentIds);
    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    revalidatePath("/[locale]/(routes)/crm/leads/[leadId]", "page");
    return { data: { leadId: data.leadId, segmentIds: data.segmentIds } };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: "Not found" };
    if (error instanceof Error && error.message === "LEAD_SEGMENT_NOT_FOUND") {
      return { error: "Lead segment not found" };
    }
    console.log("[UPDATE_LEAD_SEGMENTS]", error);
    return { error: "Failed to update lead segments" };
  }
};

export const addLeadsToSegment = async (data: {
  leadIds: string[];
  segmentId: string;
}) => {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Unauthorized" };
    throw error;
  }

  try {
    const result = await addLeadsToSegmentForUser(
      user,
      data.leadIds,
      data.segmentId
    );
    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    return { data: result };
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_SEGMENT_NOT_FOUND") {
      return { error: "Lead segment not found" };
    }
    if (error instanceof Error && error.message === "LEAD_NOT_FOUND") {
      return { error: "Some leads are not available" };
    }
    console.log("[ADD_LEADS_TO_SEGMENT]", error);
    return { error: "Failed to add leads to segment" };
  }
};
