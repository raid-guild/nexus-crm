INSERT INTO "crm_Lead_Statuses" ("name") VALUES
  ('New'),
  ('Researching'),
  ('Cold Outreach'),
  ('Follow Up'),
  ('Qualified'),
  ('Converted to Opportunity'),
  ('Nurture'),
  ('Lost')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "crm_Lead_Sources" ("name") VALUES
  ('Web'),
  ('Referral'),
  ('Cold Call'),
  ('Email Campaign'),
  ('Event'),
  ('Discord Agent'),
  ('Portal'),
  ('Import'),
  ('Form'),
  ('Scrape'),
  ('Job Listing'),
  ('Other')
ON CONFLICT ("name") DO NOTHING;

UPDATE "crm_Leads"
SET "lead_status_id" = (
  SELECT "id" FROM "crm_Lead_Statuses" WHERE "name" = 'Cold Outreach'
)
WHERE "lead_status_id" = (
  SELECT "id" FROM "crm_Lead_Statuses" WHERE "name" = 'Contacted'
);

DELETE FROM "crm_Lead_Statuses"
WHERE "name" = 'Contacted'
  AND NOT EXISTS (
    SELECT 1
    FROM "crm_Leads"
    WHERE "crm_Leads"."lead_status_id" = "crm_Lead_Statuses"."id"
  );
