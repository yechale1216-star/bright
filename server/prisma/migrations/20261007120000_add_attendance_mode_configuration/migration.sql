-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "attendanceMode" TEXT DEFAULT 'DAILY';

-- AlterTable
ALTER TABLE "SchoolSettings" ADD COLUMN IF NOT EXISTS "attendanceModeSetting" TEXT DEFAULT 'DAILY';
