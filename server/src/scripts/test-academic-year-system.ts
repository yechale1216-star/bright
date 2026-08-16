import prisma from '../config/db';
import { academicYearService } from '../services/academic-year.service';
import { createStudent, getAllStudents, deleteStudent } from '../services/student.service';
import { markAttendance, getAttendance } from '../services/attendance.service';
import { DisciplineService } from '../services/discipline.service';
import { promotionService } from '../services/promotion.service';

async function runTests() {
  console.log('🧪 Starting Academic Year Centered System Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. School Context
    const school = await prisma.school.findFirst();
    if (!school) {
      throw new Error('No school found in database');
    }
    console.log(`🏫 Testing against School: "${school.name}" (${school.id})`);

    // 2. Active Academic Year Test
    console.log('\n--- Test 1: Active Academic Year Resolution ---');
    const activeYear = await academicYearService.getCurrentAcademicYear(school.id);
    assert(!!activeYear, `Active academic year exists: "${activeYear?.name}"`);
    assert(activeYear?.isCurrent === true, 'Academic year is marked as isCurrent = true');

    if (!activeYear) return;

    // 3. Student Creation & StudentAcademicYearRecord test
    console.log('\n--- Test 2: Student Creation with Academic Year Enrollment ---');
    const testStudentId = 'TEST_AY_' + Math.floor(Math.random() * 9000 + 1000);
    const createdStudent = await createStudent({
      name: 'Test Student AY Centered',
      student_id: testStudentId,
      grade: 'Grade 9',
      section: 'A',
      parent_name: 'Test Parent',
      parent_phone: '+251911998877',
      gender: 'Male'
    }, school.id);

    assert(!!createdStudent, `Student created: ${createdStudent.fullName} (${createdStudent.student_id})`);

    // Check that StudentAcademicYearRecord was automatically created
    const enrollment = await prisma.studentAcademicYearRecord.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: createdStudent.id,
          academicYearId: activeYear.id
        }
      },
      include: { grade: true, section: true, academicYear: true }
    });

    assert(!!enrollment, 'StudentAcademicYearRecord automatically created for active academic year');
    assert(enrollment?.academicYearId === activeYear.id, `Enrollment linked to active academic year "${activeYear.name}"`);
    assert(enrollment?.grade?.name === 'Grade 9', 'Enrollment has correct grade');
    assert(enrollment?.section?.name === 'A', 'Enrollment has correct section');
    assert(enrollment?.status === 'ACTIVE', 'Enrollment status is ACTIVE');

    // 4. Test Unique Constraint on [studentId, academicYearId]
    console.log('\n--- Test 3: Duplicate Enrollment Prevention (Unique Constraint) ---');
    let duplicatePrevented = false;
    try {
      await prisma.studentAcademicYearRecord.create({
        data: {
          schoolId: school.id,
          studentId: createdStudent.id,
          academicYearId: activeYear.id,
          gradeId: enrollment!.gradeId,
          sectionId: enrollment!.sectionId,
          status: 'ACTIVE'
        }
      });
    } catch (err: any) {
      duplicatePrevented = true;
    }
    assert(duplicatePrevented, 'Database unique constraint prevented duplicate enrollment for same student in same year');

    // 5. Test Attendance Scoping & Attachment
    console.log('\n--- Test 4: Attendance Records Linked to Academic Year ---');
    const settings = await prisma.schoolSettings.findUnique({ where: { schoolId: school.id } });
    const today = new Date().toISOString().split('T')[0];
    const attendanceResult = await markAttendance({
      studentId: createdStudent.id,
      date: today,
      status: 'Present',
      remarks: 'AY Test Attendance',
      latitude: settings?.school_latitude || 9.03,
      longitude: settings?.school_longitude || 38.74,
      locationVerified: true
    }, school.id);

    assert(!!attendanceResult, 'Attendance marked successfully');
    assert(attendanceResult.academicYearId === activeYear.id, `Attendance record has academicYearId = "${activeYear.id}"`);
    assert(attendanceResult.academicYearRecordId === enrollment?.id, 'Attendance record linked to student\'s academicYearRecordId');

    // Query attendance and check active year scoping
    const attendanceList = await getAttendance({
      studentId: createdStudent.id
    }, school.id);
    assert(attendanceList.length > 0, `Attendance query found ${attendanceList.length} record(s) scoped to active year`);

    // 6. Test Discipline Incident Scoping & Attachment
    console.log('\n--- Test 5: Discipline Records Linked to Academic Year ---');
    const testAdminUser = await prisma.user.findFirst({
      where: { schoolId: school.id, role: 'school_admin' }
    });

    if (testAdminUser) {
      const incident = await DisciplineService.createIncident({
        id: testAdminUser.id,
        role: testAdminUser.role,
        schoolId: school.id,
        email: testAdminUser.email
      }, {
        studentId: createdStudent.id,
        title: 'AY Test Discipline Incident',
        description: 'Test incident description',
        categoryName: 'Classroom Misbehavior',
        severity: 'LOW'
      });

      assert(!!incident, `Discipline incident created: Case #${incident.caseNumber}`);
      assert(incident.academicYearId === activeYear.id, `Discipline incident has academicYearId = "${activeYear.id}"`);
      assert(incident.academicYearRecordId === enrollment?.id, 'Discipline incident linked to academicYearRecordId');

      // Cleanup test incident
      await prisma.studentDiscipline.delete({ where: { id: incident.id } });
    } else {
      console.log('  ⚠️ Skipped discipline test (no school_admin user found)');
    }

    // 7. Test Promotion Isolation
    console.log('\n--- Test 6: Promotion Flow with Academic Year Isolation ---');
    // Find or create next academic year for promotion test
    const nextYearName = '2019 E.C. (Test)';
    const nextYear = await prisma.academicYear.upsert({
      where: { schoolId_name: { schoolId: school.id, name: nextYearName } },
      create: {
        schoolId: school.id,
        name: nextYearName,
        startDate: new Date('2027-09-11'),
        endDate: new Date('2028-07-07'),
        isCurrent: false
      },
      update: {}
    });

    const grade10 = await prisma.grade.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Grade 10' } },
      create: { name: 'Grade 10', schoolId: school.id },
      update: {}
    });

    const promoResults = await promotionService.promoteStudents({
      studentIds: [createdStudent.id],
      toGradeId: grade10.id,
      toSectionName: 'A',
      academicYear: nextYearName,
      notes: 'Test promotion to 2019 E.C.'
    }, school.id, testAdminUser?.id || createdStudent.id);

    assert(promoResults.length > 0, 'Promotion executed successfully');

    // Check that a new StudentAcademicYearRecord was created for 2019 E.C.
    const newEnrollment = await prisma.studentAcademicYearRecord.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: createdStudent.id,
          academicYearId: nextYear.id
        }
      }
    });
    assert(!!newEnrollment, 'New StudentAcademicYearRecord created for destination academic year');
    assert(newEnrollment?.gradeId === grade10.id, 'New enrollment is for Grade 10');

    // Check that source academic year record is marked as PROMOTED
    const sourceEnrollment = await prisma.studentAcademicYearRecord.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: createdStudent.id,
          academicYearId: activeYear.id
        }
      }
    });
    assert(sourceEnrollment?.status === 'PROMOTED', 'Source academic year record marked as PROMOTED');

    // Check previous attendance is STILL linked to source academic year and intact
    const originalAttendance = await prisma.attendance.findFirst({
      where: { id: attendanceResult.id }
    });
    assert(originalAttendance?.academicYearId === activeYear.id, 'Historical attendance remains untouched and linked to 2018 E.C.');

    // 8. Cleanup test data
    console.log('\n--- Cleanup: Removing test student & promotion artifacts ---');
    await prisma.studentPromotion.deleteMany({ where: { studentId: createdStudent.id } });
    await prisma.attendance.deleteMany({ where: { studentId: createdStudent.id } });
    await prisma.studentAcademicYearRecord.deleteMany({ where: { studentId: createdStudent.id } });
    await prisma.parentStudentLink.deleteMany({ where: { studentId: createdStudent.id } });
    await prisma.parentNotification.deleteMany({ where: { studentId: createdStudent.id } });
    await deleteStudent(createdStudent.id, school.id);
    await prisma.academicYear.delete({ where: { id: nextYear.id } }).catch(() => {});
    console.log('  🧹 Cleanup complete.');

  } catch (err) {
    console.error('Test execution failed:', err);
    failed++;
  }

  console.log('\n========================================');
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
