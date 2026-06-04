-- Persist DESIGN.md per repo for UI Studio end-to-end workflow
ALTER TABLE "Repo" ADD COLUMN IF NOT EXISTS "designMd" TEXT;
