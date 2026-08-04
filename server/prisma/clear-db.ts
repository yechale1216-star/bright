/**
 * Zetime Single-School Edition — Complete Database WIPE Script (For Testing Initial Setup)
 * ─────────────────────────────────────────────────────────────────
 * Completely deletes all schools and users without re-seeding.
 * This sets `setupRequired = true` for testing the setup flow.
 *
 * Run:
 *   npx ts-node prisma/clear-db.ts
 * ─────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n⚠️   CLEARING ALL DATA FOR INITIAL SETUP TESTING\n');

  await prisma.timetableSlot.deleteMany({});
  await prisma.timetable.deleteMany({});
  await prisma.timetablePeriod.deleteMany({});

  await prisma.callHistory.deleteMany({});
  await prisma.callParticipant.deleteMany({});
  await prisma.callSession.deleteMany({});
  await prisma.messageReaction.deleteMany({});
  await prisma.messageRead.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversationMember.deleteMany({});
  await prisma.conversation.deleteMany({});

  await prisma.disciplineFollowUp.deleteMany({});
  await prisma.studentDiscipline.deleteMany({});
  await prisma.disciplineCategory.deleteMany({});

  await prisma.attendanceEditRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.parentNotification.deleteMany({});
  await prisma.attendanceReport.deleteMany({});

  await prisma.studentPromotion.deleteMany({});
  await prisma.parentStudentLink.deleteMany({});
  await prisma.student.deleteMany({});

  await prisma.teacherAssignment.deleteMany({});
  await prisma.teacher.deleteMany({});

  await prisma.academicTerm.deleteMany({});
  await prisma.academicYear.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.classroom.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.stream.deleteMany({});

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

  console.log('🗑️   Deleting all schools …');
  await prisma.school.deleteMany({});

  console.log('\n✅  All schools and users cleared. Initial setup is now required.\n');
}

main()
  .catch((e) => {
    console.error('\n❌  Wipe failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
