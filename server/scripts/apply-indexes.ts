/**
 * apply-indexes.ts
 * Directly applies the performance indexes migration without Prisma's advisory locking.
 * Safe to run multiple times — all statements use IF NOT EXISTS.
 * Run: npx ts-node scripts/apply-indexes.ts
 */

import prisma from '../src/config/db';

const INDEXES: string[] = [
  // Student query & search optimization
  `CREATE INDEX IF NOT EXISTS "Student_status_idx" ON "Student"("status")`,
  `CREATE INDEX IF NOT EXISTS "Student_fullName_idx" ON "Student"("fullName")`,
  `CREATE INDEX IF NOT EXISTS "Student_gradeId_sectionId_status_idx" ON "Student"("gradeId", "sectionId", "status")`,

  // Academic year record composite filter
  `CREATE INDEX IF NOT EXISTS "student_academic_year_records_ay_status_grade_sec_idx" ON "student_academic_year_records"("academicYearId", "status", "gradeId", "sectionId")`,

  // Historical attendance per-student lookup
  `CREATE INDEX IF NOT EXISTS "Attendance_studentId_date_idx" ON "Attendance"("studentId", "date")`,

  // Audit log indexing
  `CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id")`,

  // Parent notification retrieval
  `CREATE INDEX IF NOT EXISTS "ParentNotification_studentId_createdAt_idx" ON "ParentNotification"("studentId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ParentNotification_isRead_idx" ON "ParentNotification"("isRead")`,

  // Student discipline chronological history
  `CREATE INDEX IF NOT EXISTS "student_disciplines_studentId_date_idx" ON "student_disciplines"("studentId", "date")`,

  // Staff attendance date and session filtering
  `CREATE INDEX IF NOT EXISTS "staff_attendance_date_session_idx" ON "staff_attendance"("date", "session")`,
];

// Mark remaining un-applied baseline migrations in _prisma_migrations
const BASELINE_MIGRATIONS = [
  { id: '20260608082021_add_onboarding_status_enum',    checksum: 'skip' },
  { id: '20260728000000_add_system_roles',              checksum: 'skip' },
  { id: '20260813000000_homeroom_class_unique',         checksum: 'skip' },
  { id: '20261002100000_performance_indexes',           checksum: 'skip' },
];

async function main() {
  console.log('=== Applying Performance Indexes ===\n');

  let passed = 0;
  let failed = 0;

  for (const sql of INDEXES) {
    const name = sql.match(/"(\w+)"/)?.[1] ?? sql.slice(0, 60);
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nIndexes: ${passed} applied, ${failed} failed.`);

  // Mark remaining migrations as applied in _prisma_migrations
  console.log('\n=== Marking baseline migrations as applied ===\n');
  for (const m of BASELINE_MIGRATIONS) {
    try {
      // Upsert into _prisma_migrations
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations" 
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES 
          ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)
        ON CONFLICT (id) DO NOTHING
      `, m.id, m.checksum, m.id.substring(15));
      console.log(`  ✅ Marked: ${m.id}`);
    } catch (err: any) {
      console.log(`  ℹ️  Skipped (already marked or error): ${m.id} — ${err.message?.slice(0, 80)}`);
    }
  }

  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
