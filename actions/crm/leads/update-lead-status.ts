"use server";

import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import {
  AuthenticationError,
  AuthorizationError,
  assertCanReadLead,
  requireAuthenticated,
} from "@/lib/authz";
import { prismadb } from "@/lib/prisma";

export const updateLeadStatus = async (data: {
  id: string;
  lead_status_id: string | null;
}) => {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return { error: "Unauthorized" };
    throw error;
  }

  const { id, lead_status_id } = data;
  if (!id) return { error: "Lead id is required" };

  try {
    await assertCanReadLead(user, id);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: "Not found" };
    throw error;
  }

  try {
    if (lead_status_id) {
      const status = await prismadb.crm_Lead_Statuses.findUnique({
        where: { id: lead_status_id },
        select: { id: true },
      });

      if (!status) return { error: "Lead status not found" };
    }

    const before = await prismadb.crm_Leads.findFirst({
      where: { id, deletedAt: null },
    });

    if (!before) return { error: "Lead not found" };

    const lead = await prismadb.crm_Leads.update({
      where: { id },
      data: {
        lead_status_id,
        updatedBy: user.id,
      },
      include: {
        assigned_to_user: { select: { id: true, name: true, avatar: true } },
        lead_source: { select: { id: true, name: true } },
        lead_status: { select: { id: true, name: true } },
        lead_type: { select: { id: true, name: true } },
        assigned_accounts: true,
      },
    });

    await writeAuditLog({
      entityType: "lead",
      entityId: lead.id,
      action: "updated",
      changes: diffObjects(
        before as Record<string, unknown>,
        lead as Record<string, unknown>
      ),
      userId: user.id,
    });

    void inngest.send({ name: "crm/lead.saved", data: { record_id: lead.id } });
    revalidatePath("/[locale]/(routes)/crm/leads", "page");

    return { data: lead };
  } catch (error) {
    console.log("[UPDATE_LEAD_STATUS]", error);
    return { error: "Failed to update lead status" };
  }
};
