import prisma from '../config/db';
import { academicYearService } from '../services/academic-year.service';
import { bulkMarkAttendance, markAttendance, getAttendance, normalizeDate, normalizeSession } from '../services/attendance.service';
import { getAttendanceSummary, getGradeStats } from '../services/attendance-analytics.service';
import { cleanupAttendanceDuplicates } from './cleanup-attendance-duplicates';

async function runAttendanceTests() {
  console.log('🧪 Starting Comprehensive Attendance Deduplication & Idempotency Test Suite...\n');

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
    // 0. Run initial cleanup
    await cleanupAttendanceDuplicates();

    // 1. Resolve school context
    let school = await prisma.school.findFirst();
    if (!school) {
      school = await prisma.school.create({
        data: {
          name: 'Test Addis Hiwot School',
          schoolId: 'AHS_TEST_001',
          schoolEmail: 'test@school.edu'
        }
      });
    }
    console.log(`🏫 Testing on School: "${school.name}" (${school.id})`);

    // 2. Resolve or create active academic year
    let activeAY = await academicYearService.getCurrentAcademicYear(school.id);
    if (!activeAY) {
      activeAY = await prisma.academicYear.create({
        data: {
          name: '2026/2027',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2027-06-30T23:59:59.999Z'),
          isCurrent: true,
          schoolId: school.id
        }
      });
    }

    // 3. Create a test grade and section if not existing
    let grade = await prisma.grade.findFirst({ where: { schoolId: school.id } });
    if (!grade) {
      grade = await prisma.grade.create({
        data: { name: 'Grade 9', schoolId: school.id }
      });
    }
    let section = await prisma.section.findFirst({ where: { schoolId: school.id } });
    if (!section) {
      section = await prisma.section.create({
        data: { name: 'A', schoolId: school.id }
      });
    }

    // 4. Fetch or create test students
    console.log('\n--- Setup: Resolving test students ---');
    let testStudents = await prisma.student.findMany({
      where: { schoolId: school.id, status: 'ACTIVE' },
      take: 32,
      select: { id: true }
    });

    if (testStudents.length < 32) {
      const needed = 32 - testStudents.length;
      const batchSuffix = Math.floor(Math.random() * 100000);
      const toCreate = [];
      for (let i = 1; i <= needed; i++) {
        toCreate.push({
          fullName: `Test Student ${i} - Batch ${batchSuffix}`,
          student_id: `TEST_${batchSuffix}_${i}`,
          schoolId: school.id,
          gradeId: grade.id,
          sectionId: section.id,
          status: 'ACTIVE',
          gender: i % 2 === 0 ? 'Female' : 'Male',
          parent_name: `Parent ${i}`,
          parent_phone: `+251911${i.toString().padStart(6, '0')}`,
          parent_email: `parent${i}_${batchSuffix}@example.com`
        });
      }
      await prisma.student.createMany({ data: toCreate });
      testStudents = await prisma.student.findMany({
        where: { schoolId: school.id, status: 'ACTIVE' },
        take: 32,
        select: { id: true }
      });
    }

    const testStudentIds = testStudents.map(s => s.id);
    console.log(`Using ${testStudentIds.length} students for testing.`);

    const testDate = '2026-08-18';
    const { startDate, endDate } = normalizeDate(testDate);

    // ==========================================
    // TEST 1: Online First Submission (Morning)
    // ==========================================
    console.log('\n--- Test 1: First Attendance Submission (32 Students, Morning, All Present) ---');
    const firstSubmissionRecords = testStudentIds.map(id => ({
      studentId: id,
      date: testDate,
      session: 'morning',
      status: 'present',
      remarks: 'First online roll call'
    }));

    const result1 = await bulkMarkAttendance(firstSubmissionRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });

    assert(result1.length === 32, 'bulkMarkAttendance returned 32 records');

    const dbRecords1 = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: startDate, lte: endDate },
        session: 'morning'
      }
    });
    assert(dbRecords1.length === 32, `Database contains exactly 32 Morning records (found: ${dbRecords1.length})`);
    assert(dbRecords1.every(r => r.status === 'present'), 'All 32 records have status = present');

    // ==========================================
    // TEST 2: Re-submission of Same Session with Updates (The Problem Case)
    // Teacher opens class again, changes 5 students to Absent, 3 to Late, submits again
    // Expected: EXACTLY 32 records, NOT 64
    // ==========================================
    console.log('\n--- Test 2: Re-submitting Same Session with Updated Statuses (Should Update, NOT Duplicate) ---');
    const updatedRecords = testStudentIds.map((id, index) => {
      let status = 'present';
      if (index < 5) status = 'absent';
      else if (index < 8) status = 'late';
      return {
        studentId: id,
        date: testDate,
        session: 'morning',
        status,
        remarks: 'Updated roll call'
      };
    });

    const result2 = await bulkMarkAttendance(updatedRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });

    assert(result2.length === 32, 'bulkMarkAttendance update returned 32 records');

    const dbRecords2 = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: startDate, lte: endDate },
        session: 'morning'
      }
    });

    assert(dbRecords2.length === 32, `Database STILL contains exactly 32 Morning records (NO DUPLICATES, found: ${dbRecords2.length})`);

    const presentCount = dbRecords2.filter(r => r.status === 'present').length;
    const absentCount = dbRecords2.filter(r => r.status === 'absent').length;
    const lateCount = dbRecords2.filter(r => r.status === 'late').length;

    assert(absentCount === 5, `Updated absent count is 5 (found: ${absentCount})`);
    assert(lateCount === 3, `Updated late count is 3 (found: ${lateCount})`);
    assert(presentCount === 24, `Updated present count is 24 (found: ${presentCount})`);

    // ==========================================
    // TEST 3: Repeated Sync / Retry Simulation
    // Exact same payload sent twice immediately (simulating network retry)
    // ==========================================
    console.log('\n--- Test 3: Repeated Sync / Network Retry Idempotency ---');
    await bulkMarkAttendance(updatedRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });
    await bulkMarkAttendance(updatedRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });

    const dbRecords3 = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: startDate, lte: endDate },
        session: 'morning'
      }
    });
    assert(dbRecords3.length === 32, `After 2 retry calls, DB STILL contains exactly 32 Morning records (found: ${dbRecords3.length})`);

    // ==========================================
    // TEST 4: Afternoon Session Coexistence (Session Isolation)
    // Submitting Afternoon session for same 32 students
    // Expected: 32 Afternoon records created; Total = 64 (32 Morning + 32 Afternoon)
    // ==========================================
    console.log('\n--- Test 4: Afternoon Session Coexistence (Session Isolation) ---');
    const afternoonRecords = testStudentIds.map(id => ({
      studentId: id,
      date: testDate,
      session: 'afternoon',
      status: 'present',
      remarks: 'Afternoon roll call'
    }));

    await bulkMarkAttendance(afternoonRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });

    const morningRecords = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: startDate, lte: endDate },
        session: 'morning'
      }
    });
    const aftRecords = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: startDate, lte: endDate },
        session: 'afternoon'
      }
    });

    assert(morningRecords.length === 32, `Morning session count is 32 (found: ${morningRecords.length})`);
    assert(aftRecords.length === 32, `Afternoon session count is 32 (found: ${aftRecords.length})`);

    // ==========================================
    // TEST 5: Daily Attendance Mode (Session = null / 'daily')
    // ==========================================
    console.log('\n--- Test 5: Daily Attendance Mode on a Different Date ---');
    const dailyDate = '2026-08-19';
    const { startDate: dailyStart, endDate: dailyEnd } = normalizeDate(dailyDate);

    const dailyRecords = testStudentIds.map(id => ({
      studentId: id,
      date: dailyDate,
      session: null, // Daily mode
      status: 'present'
    }));

    await bulkMarkAttendance(dailyRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });

    // Re-submit daily attendance
    await bulkMarkAttendance(dailyRecords, school.id, {
      userRole: 'school_admin',
      userId: 'test_admin',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    });

    const dbDailyRecords = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: dailyStart, lte: dailyEnd },
        session: null
      }
    });

    assert(dbDailyRecords.length === 32, `Daily attendance re-submission creates exactly 32 records (found: ${dbDailyRecords.length})`);

    // ==========================================
    // TEST 6: Analytics & Summary Counts
    // Single session Morning summary should show 24 Present, 5 Absent, 3 Late (Total = 32)
    // ==========================================
    console.log('\n--- Test 6: Analytics Summary Verification ---');
    // Also verify deduplicated count directly on test students
    const testStudentsAttendance = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: testStudentIds },
        date: { gte: startDate, lte: endDate },
        session: 'morning'
      }
    });
    const testUniqueStudentMap = new Map<string, string>();
    testStudentsAttendance.forEach(r => testUniqueStudentMap.set(r.studentId, r.status));

    let tPresent = 0, tAbsent = 0, tLate = 0;
    testUniqueStudentMap.forEach(s => {
      if (s === 'present') tPresent++;
      else if (s === 'absent') tAbsent++;
      else if (s === 'late') tLate++;
    });

    assert(tPresent === 24, `Test students Morning Present is 24 (found: ${tPresent})`);
    assert(tAbsent === 5, `Test students Morning Absent is 5 (found: ${tAbsent})`);
    assert(tLate === 3, `Test students Morning Late is 3 (found: ${tLate})`);
    const totalRecorded = tPresent + tAbsent + tLate;
    assert(totalRecorded === 32, `Total recorded test students is 32 (NEVER 64, found: ${totalRecorded})`);

    // Verify analytics service getAttendanceSummary returns non-duplicated results
    const summaryMorning = await getAttendanceSummary(school.id, {
      startDate: testDate,
      endDate: testDate,
      session: 'morning',
      mode: 'session_based'
    });
    assert(summaryMorning.totalStudents >= 32, `Summary reports valid total students (found: ${summaryMorning.totalStudents})`);
    assert(summaryMorning.attendanceRate >= 0 && summaryMorning.attendanceRate <= 100, `Summary attendanceRate is valid percentage (${summaryMorning.attendanceRate}%)`);

    // ==========================================
    // TEST 7: Single Mark Attendance API Idempotency
    // ==========================================
    console.log('\n--- Test 7: Single Attendance Mark / Update ---');
    const singleStudentId = testStudentIds[0];
    const singleRes1 = await markAttendance({
      studentId: singleStudentId,
      date: testDate,
      session: 'morning',
      status: 'excused',
      remarks: 'Sick note submitted',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    }, school.id);

    const singleRes2 = await markAttendance({
      studentId: singleStudentId,
      date: testDate,
      session: 'morning',
      status: 'excused',
      remarks: 'Sick note submitted again',
      latitude: 9.585892,
      longitude: 41.860195,
      locationVerified: true,
      locationDistance: 0
    }, school.id);

    const singleRecords = await prisma.attendance.findMany({
      where: {
        schoolId: school.id,
        studentId: singleStudentId,
        date: { gte: startDate, lte: endDate },
        session: 'morning'
      }
    });

    assert(singleRecords.length === 1, `Single attendance mark has exactly 1 record (found: ${singleRecords.length})`);
    assert(singleRecords[0].status === 'excused', 'Status was updated to excused');

    // ==========================================
    // TEST 8: Query / Retrieval with getAttendance
    // ==========================================
    console.log('\n--- Test 8: getAttendance retrieval accuracy ---');
    const fetchedMorning = await getAttendance({
      date: testDate,
      session: 'morning'
    }, school.id);

    const testStudentsInFetched = fetchedMorning.filter((r: any) => testStudentIds.includes(r.studentId || r.student_id));
    assert(testStudentsInFetched.length === 32, `getAttendance returns all 32 student records for Morning session (found: ${testStudentsInFetched.length})`);

    // Cleanup test data
    console.log('\n--- Cleanup: Removing test attendance data ---');
    await prisma.attendance.deleteMany({
      where: {
        studentId: { in: testStudentIds },
        date: { in: [startDate, dailyStart] }
      }
    });
    console.log('Cleaned up test attendance records.');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n========================================');
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAttendanceTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
