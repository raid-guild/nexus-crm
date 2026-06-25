ALTER TABLE "crm_Leads"
  ADD COLUMN IF NOT EXISTS "converted_opportunity_id" UUID;

CREATE INDEX IF NOT EXISTS "crm_Leads_converted_opportunity_id_idx"
  ON "crm_Leads"("converted_opportunity_id");

ALTER TABLE "crm_Leads"
  ADD CONSTRAINT "crm_Leads_converted_opportunity_id_fkey"
  FOREIGN KEY ("converted_opportunity_id") REFERENCES "crm_Opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
