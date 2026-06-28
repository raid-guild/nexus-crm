ALTER TABLE "crm_Leads"
ADD COLUMN "probability_score" INTEGER;

ALTER TABLE "crm_Leads"
ADD CONSTRAINT "crm_Leads_probability_score_check"
CHECK (
  "probability_score" IS NULL
  OR ("probability_score" >= 0 AND "probability_score" <= 100)
);
