-- Migration: Add status field to academic_years
-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AcademicYearStatus" AS ENUM ('FUTURE', 'ACTIVE', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "status" "AcademicYearStatus" NOT NULL DEFAULT 'FUTURE';

-- Backfill: active year(s) -> ACTIVE
UPDATE "academic_years" SET "status" = 'ACTIVE' WHERE "isCurrent" = true;
