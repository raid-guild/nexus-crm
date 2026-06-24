"use server";

import { getActivitiesByEntity } from "@/actions/crm/activities/get-activities-by-entity";
import { getLead } from "@/actions/crm/get-lead";

export const getLeadBoardDetail = async (
  leadId: string
): Promise<
  | { error: string; data?: undefined }
  | {
      data: {
        lead: NonNullable<Awaited<ReturnType<typeof getLead>>>;
        activities: Awaited<ReturnType<typeof getActivitiesByEntity>>;
      };
      error?: undefined;
    }
> => {
  if (!leadId) return { error: "Lead id is required" };

  const lead = await getLead(leadId);
  if (!lead) return { error: "Lead not found" };

  const activities = await getActivitiesByEntity("lead", leadId);

  return { data: { lead, activities } };
};
