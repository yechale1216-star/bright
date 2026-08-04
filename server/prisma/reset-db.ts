/**
 * Zetime Single-School Edition — Database RESET Script
 * ─────────────────────────────────────────────────────────────────
 * Wipes ALL school data while keeping database structure intact.
 * After the wipe it re-seeds the default School Administrator so
 * the system is immediately usable.
 *
 * Run:
 *   npx ts-node prisma/reset-db.ts
 * ─────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n⚠️   ZETIME DATABASE RESET (Single-School Edition)\n');
  console.log('This will permanently delete ALL data and re-seed the school admin.\n');

  // ── Step 1: Delete in safe dependency order ──────────────────────────────

  console.log('🗑️   Deleting timetable data …');
  await prisma.timetableSlot.deleteMany({});
  await prisma.timetable.deleteMany({});
  await prisma.timetablePeriod.deleteMany({});

  console.log('🗑️   Deleting messaging & call data …');
  await prisma.callHistory.deleteMany({});
  await prisma.callParticipant.deleteMany({});
  await prisma.callSession.deleteMany({});
  await prisma.messageReaction.deleteMany({});
  await prisma.messageRead.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversationMember.deleteMany({});
  await prisma.conversation.deleteMany({});

  console.log('🗑️   Deleting discipline data …');
  await prisma.disciplineFollowUp.deleteMany({});
  await prisma.studentDiscipline.deleteMany({});
  await prisma.disciplineCategory.deleteMany({});

  console.log('🗑️   Deleting attendance & notifications …');
  await prisma.attendanceEditRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.parentNotification.deleteMany({});
  await prisma.attendanceReport.deleteMany({});

  console.log('🗑️   Deleting student data …');
  await prisma.studentPromotion.deleteMany({});
  await prisma.parentStudentLink.deleteMany({});
  await prisma.student.deleteMany({});

  console.log('🗑️   Deleting teacher data …');
  await prisma.teacherAssignment.deleteMany({});
  await prisma.teacher.deleteMany({});

  console.log('🗑️   Deleting academic structure …');
  await prisma.academicTerm.deleteMany({});
  await prisma.academicYear.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.classroom.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.stream.deleteMany({});

  console.log('🗑️   Deleting school-level records …');
  await prisma.auditLog.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.userNotification.deleteMany({});
  await prisma.systemRole.deleteMany({});
  await prisma.schoolSettings.deleteMany({});
  await prisma.parentPreferences.deleteMany({});
  await prisma.pendingRegistration.deleteMany({});
  await prisma.broadcastLog.deleteMany({});

  console.log('🗑️   Deleting all users …');
  await prisma.user.deleteMany({});

  console.log('🗑️   Deleting the school …');
  await prisma.school.deleteMany({});

  console.log('\n✅  All data cleared.\n');

  // ── Step 2: Re-seed the school and School Administrator ─────────────────

  console.log('🏫  Re-creating School …');
  const school = await prisma.school.create({
    data: {
      name: 'My School',
      schoolEmail: 'admin@myschool.edu',
      schoolId: 'SCH-0001',
    }
  });
  console.log(`   ✓ School: ${school.name} (${school.id})\n`);

  console.log('👑  Re-creating School Administrator …');
  const bcrypt = require('bcryptjs');
  const admin = await prisma.user.create({
    data: {
      email: 'abinet21x@gmail.com',
      password_hash: bcrypt.hashSync('q123456', 10),
      full_name: 'School Administrator',
      role: 'admin',
      is_active: true,
      is_verified: true,
      schoolId: school.id,
    }
  });
  console.log(`   ✓ ${admin.full_name} (${admin.email})\n`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('🎉  Database is clean and ready!\n');
  console.log('  SCHOOL ADMIN LOGIN');
  console.log('  Email    : abinet21x@gmail.com');
  console.log('  Password : q123456\n');

  console.log('  You can now configure the school from the Admin dashboard.');
  console.log('═══════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('\n❌  Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
