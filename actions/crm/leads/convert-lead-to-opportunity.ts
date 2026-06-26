"use server";

import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import {
  AuthenticationError,
  AuthorizationError,
  assertCanReadLead,
  requireAuthenticated,
} from "@/lib/authz";
import { prismadb } from "@/lib/prisma";

export const convertLeadToOpportunity = async (data: { leadId: string }) => {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Unauthorized" };
    throw error;
  }

  try {
    await assertCanReadLead(user, data.leadId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: "Not found" };
    throw error;
  }

  try {
    const result = await prismadb.$transaction(async (tx: any) => {
      const lead = await tx.crm_Leads.findFirst({
        where: { id: data.leadId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          description: true,
          accountsIDs: true,
          assigned_to: true,
          converted_opportunity_id: true,
          lead_status_id: true,
        },
      });

      if (!lead) return { error: "Lead not found" };
      if (lead.converted_opportunity_id) {
        return {
          data: {
            opportunityId: lead.converted_opportunity_id,
            alreadyConverted: true,
          },
        };
      }

      const convertedStatus = await tx.crm_Lead_Statuses.findFirst({
        where: {
          name: { equals: "Converted to Opportunity", mode: "insensitive" },
        },
        select: { id: true },
      });

      const opportunity = await tx.crm_Opportunities.create({
        data: {
          v: 0,
          name:
            lead.company ??
            [lead.firstName, lead.lastName].filter(Boolean).join(" "),
          description: lead.description ?? undefined,
          account: lead.accountsIDs ?? undefined,
          assigned_to: lead.assigned_to ?? user.id,
          createdBy: user.id,
          updatedBy: user.id,
          last_activity_by: user.id,
          status: "ACTIVE",
        },
      });

      const updatedLead = await tx.crm_Leads.update({
        where: { id: lead.id },
        data: {
          converted_opportunity_id: opportunity.id,
          lead_status_id: convertedStatus?.id ?? lead.lead_status_id,
          updatedBy: user.id,
        },
      });

      return { data: { lead: updatedLead, opportunityId: opportunity.id } };
    });

    if (result.error) return { error: result.error };
    const conversion = result.data;
    if (!conversion) return { error: "Failed to convert lead" };

    if (!conversion.alreadyConverted) {
      await writeAuditLog({
        entityType: "lead",
        entityId: data.leadId,
        action: "updated",
        changes: [
          {
            field: "converted_opportunity_id",
            old: null,
            new: conversion.opportunityId,
          },
        ],
        userId: user.id,
      });
      void inngest.send({
        name: "crm/opportunity.saved",
        data: { record_id: conversion.opportunityId },
      });
      void inngest.send({
        name: "crm/lead.saved",
        data: { record_id: data.leadId },
      });
    }

    revalidatePath("/[locale]/(routes)/crm/leads", "page");
    revalidatePath("/[locale]/(routes)/crm/leads/[leadId]", "page");
    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");

    return result;
  } catch (error) {
    console.log("[CONVERT_LEAD_TO_OPPORTUNITY]", error);
    return { error: "Failed to convert lead" };
  }
};
