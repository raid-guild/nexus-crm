import { z } from "zod";

// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
export const leadSchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date().optional().nullable(),
  updatedAt: z.coerce.date().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().min(1).max(30),
  company: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lead_source_id: z.string().optional().nullable(),
  lead_status_id: z.string().optional().nullable(),
  lead_type_id: z.string().optional().nullable(),
  refered_by: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  accountsIDs: z.string().optional().nullable(),
  assigned_to_user: z.object({}).optional().nullable(),
  assigned_accounts: z.object({}).optional().nullable(),
  lead_source: z.object({}).optional().nullable(),
  lead_status: z.object({}).optional().nullable(),
  lead_type: z.object({}).optional().nullable(),
});

export type Lead = z.infer<typeof leadSchema>;
