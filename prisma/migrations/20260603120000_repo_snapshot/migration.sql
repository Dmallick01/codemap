-- AlterTable
ALTER TABLE "Repo" ADD COLUMN "storageMode" TEXT NOT NULL DEFAULT 'snapshot';
ALTER TABLE "Repo" ADD COLUMN "snapshot" TEXT;
