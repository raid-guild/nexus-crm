ALTER TABLE "Documents"
  ADD COLUMN IF NOT EXISTS "prism_enrichment_status" TEXT,
  ADD COLUMN IF NOT EXISTS "prism_run_id" TEXT,
  ADD COLUMN IF NOT EXISTS "prism_artifact_id" TEXT,
  ADD COLUMN IF NOT EXISTS "prism_memory_url" TEXT;

CREATE INDEX IF NOT EXISTS "Documents_prism_enrichment_status_idx"
  ON "Documents"("prism_enrichment_status");

CREATE INDEX IF NOT EXISTS "Documents_prism_run_id_idx"
  ON "Documents"("prism_run_id");
