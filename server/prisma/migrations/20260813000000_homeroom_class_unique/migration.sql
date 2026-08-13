-- Migration: Enforce "one class = one homeroom teacher" at database level
-- Business Rule: A class/section can have at most ONE active TeacherAssignment.
--                A teacher MAY appear in multiple classes (teacher_id is NOT in the unique key).
--
-- Pre-check confirmed: 3 existing assignments, zero duplicates. Safe to apply.

-- Create unique index on (schoolId, gradeId, sectionId, streamId)
-- Note: streamId is nullable. PostgreSQL treats two NULLs as DISTINCT in unique indexes,
-- so (schoolId, gradeId, sectionId, NULL) and (schoolId, gradeId, sectionId, NULL) would
-- be considered EQUAL only with a partial index or application-level handling.
-- We use CREATE UNIQUE INDEX with NULLS NOT DISTINCT (PostgreSQL 15+) or handle via app layer.

-- Check Postgres version compatibility
DO $$
DECLARE
  pg_version int;
BEGIN
  pg_version := current_setting('server_version_num')::int;
  IF pg_version >= 150000 THEN
    -- PostgreSQL 15+: use NULLS NOT DISTINCT so two NULL streamIds count as the same
    EXECUTE 'CREATE UNIQUE INDEX "TeacherAssignment_class_unique_idx"
             ON "TeacherAssignment"("schoolId", "gradeId", "sectionId", "streamId")
             NULLS NOT DISTINCT';
    RAISE NOTICE 'Created unique index with NULLS NOT DISTINCT (PostgreSQL 15+)';
  ELSE
    -- PostgreSQL < 15: create a partial index for NULL streamId rows + regular index for non-NULL
    EXECUTE 'CREATE UNIQUE INDEX "TeacherAssignment_class_unique_idx"
             ON "TeacherAssignment"("schoolId", "gradeId", "sectionId", "streamId")
             WHERE "streamId" IS NOT NULL';
    EXECUTE 'CREATE UNIQUE INDEX "TeacherAssignment_class_no_stream_unique_idx"
             ON "TeacherAssignment"("schoolId", "gradeId", "sectionId")
             WHERE "streamId" IS NULL';
    RAISE NOTICE 'Created partial unique indexes for PostgreSQL < 15';
  END IF;
END
$$;
