import prisma from '../config/db';
import { academicYearService } from '../services/academic-year.service';

export async function runAcademicYearMigration() {
  console.log('🚀 Starting Academic Year Context Migration...');

  let totalStudentsMigrated = 0;
  let totalAttendanceUpdated = 0;
  let totalDisciplineUpdated = 0;

  // 1. Get or create active academic year
  const activeYear = await academicYearService.getCurrentAcademicYear();
  if (!activeYear) {
    console.warn(`⚠️ Could not resolve active academic year`);
    return;
  }
  console.log(`   Active Academic Year: "${activeYear.name}" (${activeYear.id})`);

  // 2. Migrate students -> StudentAcademicYearRecord
  const students = await prisma.student.findMany();

  console.log(`   Found ${students.length} student(s). Backfilling academic year records...`);

  const studentRecordMap: Record<string, string> = {}; // studentId -> studentAcademicYearRecordId

  for (const student of students) {
    const record = await prisma.studentAcademicYearRecord.upsert({
      where: {
        studentId_academicYearId: {
          studentId: student.id,
          academicYearId: activeYear.id
        }
      },
      create: {
        studentId: student.id,
        academicYearId: activeYear.id,
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        streamId: student.streamId,
        status: student.status || 'ACTIVE'
      },
      update: {
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        streamId: student.streamId,
        status: student.status || 'ACTIVE'
      }
    });

    studentRecordMap[student.id] = record.id;
    totalStudentsMigrated++;
  }

  // 3. Backfill Attendance records without academicYearId
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      academicYearId: null
    },
    select: { id: true, studentId: true }
  });

  if (attendanceRecords.length > 0) {
    console.log(`   Backfilling ${attendanceRecords.length} attendance record(s)...`);
    for (const att of attendanceRecords) {
      const recId = studentRecordMap[att.studentId] || null;
      await prisma.attendance.update({
        where: { id: att.id },
        data: {
          academicYearId: activeYear.id,
          academicYearRecordId: recId
        }
      });
      totalAttendanceUpdated++;
    }
  }

  // 4. Backfill StudentDiscipline records without academicYearId
  const disciplineRecords = await prisma.studentDiscipline.findMany({
    where: {
      academicYearId: null
    },
    select: { id: true, studentId: true }
  });

  if (disciplineRecords.length > 0) {
    console.log(`   Backfilling ${disciplineRecords.length} discipline record(s)...`);
    for (const disc of disciplineRecords) {
      const recId = studentRecordMap[disc.studentId] || null;
      await prisma.studentDiscipline.update({
        where: { id: disc.id },
        data: {
          academicYearId: activeYear.id,
          academicYearRecordId: recId
        }
      });
      totalDisciplineUpdated++;
    }
  }

  console.log('\n========================================');
  console.log('✅ Academic Year Context Migration Completed!');
  console.log(`   • Student Records Created/Updated: ${totalStudentsMigrated}`);
  console.log(`   • Attendance Records Backfilled:   ${totalAttendanceUpdated}`);
  console.log(`   • Discipline Records Backfilled:   ${totalDisciplineUpdated}`);
  console.log('========================================\n');
}

// Run directly if invoked from command line
if (require.main === module) {
  runAcademicYearMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
