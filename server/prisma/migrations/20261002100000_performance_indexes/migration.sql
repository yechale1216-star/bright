-- Migration: Performance and Scalability Indexes
-- Adds targeted indexes for large-scale production query performance.
-- All statements use IF NOT EXISTS to guarantee safe, non-destructive execution.

-- Student query & search optimization
CREATE INDEX IF NOT EXISTS "Student_status_idx" ON "Student"("status");
CREATE INDEX IF NOT EXISTS "Student_fullName_idx" ON "Student"("fullName");
CREATE INDEX IF NOT EXISTS "Student_gradeId_sectionId_status_idx" ON "Student"("gradeId", "sectionId", "status");

-- Academic year record composite filter
CREATE INDEX IF NOT EXISTS "student_academic_year_records_ay_status_grade_sec_idx" 
  ON "student_academic_year_records"("academicYearId", "status", "gradeId", "sectionId");

-- Historical attendance per-student lookup
CREATE INDEX IF NOT EXISTS "Attendance_studentId_date_idx" ON "Attendance"("studentId", "date");

-- Audit log indexing (essential for high-volume log filtering)
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- Parent notification retrieval
CREATE INDEX IF NOT EXISTS "ParentNotification_studentId_createdAt_idx" ON "ParentNotification"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "ParentNotification_isRead_idx" ON "ParentNotification"("isRead");

-- Student discipline chronological history
CREATE INDEX IF NOT EXISTS "student_disciplines_studentId_date_idx" ON "student_disciplines"("studentId", "date");

-- Staff attendance date and session filtering
CREATE INDEX IF NOT EXISTS "staff_attendance_date_session_idx" ON "staff_attendance"("date", "session");
