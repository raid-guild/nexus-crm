CREATE TABLE IF NOT EXISTS "crm_Lead_Segments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "__v" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "audience" TEXT,
  "region" TEXT,
  "source" TEXT,
  "criteria" JSONB,
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "deletedBy" UUID
);

CREATE TABLE IF NOT EXISTS "crm_LeadSegmentMembers" (
  "lead_id" UUID NOT NULL,
  "segment_id" UUID NOT NULL,
  "import_batch_id" UUID,
  "status" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),

  CONSTRAINT "crm_LeadSegmentMembers_pkey" PRIMARY KEY ("lead_id", "segment_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_Lead_Segments_name_createdBy_key"
  ON "crm_Lead_Segments"("name", "createdBy");

CREATE INDEX IF NOT EXISTS "crm_Lead_Segments_createdBy_idx"
  ON "crm_Lead_Segments"("createdBy");
CREATE INDEX IF NOT EXISTS "crm_Lead_Segments_name_idx"
  ON "crm_Lead_Segments"("name");
CREATE INDEX IF NOT EXISTS "crm_Lead_Segments_source_idx"
  ON "crm_Lead_Segments"("source");
CREATE INDEX IF NOT EXISTS "crm_Lead_Segments_region_idx"
  ON "crm_Lead_Segments"("region");
CREATE INDEX IF NOT EXISTS "crm_Lead_Segments_createdAt_idx"
  ON "crm_Lead_Segments"("createdAt");
CREATE INDEX IF NOT EXISTS "crm_Lead_Segments_deletedAt_idx"
  ON "crm_Lead_Segments"("deletedAt");

CREATE INDEX IF NOT EXISTS "crm_LeadSegmentMembers_lead_id_idx"
  ON "crm_LeadSegmentMembers"("lead_id");
CREATE INDEX IF NOT EXISTS "crm_LeadSegmentMembers_segment_id_idx"
  ON "crm_LeadSegmentMembers"("segment_id");
CREATE INDEX IF NOT EXISTS "crm_LeadSegmentMembers_import_batch_id_idx"
  ON "crm_LeadSegmentMembers"("import_batch_id");
CREATE INDEX IF NOT EXISTS "crm_LeadSegmentMembers_status_idx"
  ON "crm_LeadSegmentMembers"("status");

ALTER TABLE "crm_Lead_Segments"
  ADD CONSTRAINT "crm_Lead_Segments_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_LeadSegmentMembers"
  ADD CONSTRAINT "crm_LeadSegmentMembers_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "crm_Leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_LeadSegmentMembers"
  ADD CONSTRAINT "crm_LeadSegmentMembers_segment_id_fkey"
  FOREIGN KEY ("segment_id") REFERENCES "crm_Lead_Segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
