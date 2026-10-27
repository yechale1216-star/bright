const assert = require('assert');

async function runE2ETests() {
  console.log('====================================================');
  console.log('   Bright Path Student Lifecycle E2E Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  const prisma = require('../dist/config/db').default;
  const { changeStudentStatus, getStudentStatusHistory, reEnrollStudent } = require('../dist/services/student-status.service');
  const { checkStudentEligibility } = require('../dist/services/student-eligibility.service');
  const { getLifecyclePolicy, updateLifecyclePolicy, DEFAULT_LIFECYCLE_POLICIES } = require('../dist/services/lifecycle-policy.service');

  // Setup: Ensure a test grade and section exist
  const testGrade = await prisma.grade.upsert({
    where: { name: 'Test Grade 9' },
    update: {},
    create: { name: 'Test Grade 9' },
  });

  let testSection = await prisma.section.findFirst({
    where: { gradeId: testGrade.id, name: 'A' },
  });
  if (!testSection) {
    testSection = await prisma.section.create({
      data: { name: 'A', gradeId: testGrade.id },
    });
  }

  const testAY = await prisma.academicYear.upsert({
    where: { name: '2018/2019 E.C.' },
    update: {},
    create: {
      name: '2018/2019 E.C.',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-06-30'),
      isCurrent: true,
    },
  });

  const testStudentId = `TEST_STU_${Date.now()}`;
  let studentRecord = await prisma.student.create({
    data: {
      student_id: testStudentId,
      fullName: 'Lifecycle Test Student',
      parent_name: 'Test Parent',
      parent_email: 'parent@test.com',
      parent_phone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
      gradeId: testGrade.id,
      sectionId: testSection.id,
      status: 'ACTIVE',
      accountStatus: 'ACTIVE',
    },
  });

  await prisma.studentAcademicYearRecord.create({
    data: {
      studentId: studentRecord.id,
      academicYearId: testAY.id,
      gradeId: testGrade.id,
      sectionId: testSection.id,
      status: 'ACTIVE',
    },
  });

  console.log(`Created test student ${studentRecord.fullName} (${studentRecord.student_id})\n`);

  console.log('--- E2E 1: Status Transitions & Audit History ---');

  await test('1. ACTIVE -> SUSPENDED with valid suspension dates', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { student, historyEntry } = await changeStudentStatus(studentRecord.id, {
      newStatus: 'SUSPENDED',
      effectiveDate: tomorrow,
      suspensionEndDate: nextWeek,
      reason: 'Disciplinary suspension for 7 days',
      changedByUserId: 'test-admin-id',
    });

    assert.strictEqual(student.status, 'SUSPENDED');
    assert.strictEqual(historyEntry.fromStatus, 'ACTIVE');
    assert.strictEqual(historyEntry.toStatus, 'SUSPENDED');
  });

  await test('2. SUSPENDED student is blocked from attendance marking under policy', async () => {
    const elig = await checkStudentEligibility(studentRecord.id, 'ATTENDANCE_MARK');
    assert.strictEqual(elig.eligible, false);
    assert.ok(elig.reason.includes('temporarily suspended'));
  });

  await test('3. SUSPENDED student is blocked from promotion', async () => {
    const elig = await checkStudentEligibility(studentRecord.id, 'PROMOTION');
    assert.strictEqual(elig.eligible, false);
    assert.ok(elig.reason.includes('Only students with ACTIVE lifecycle status can be promoted'));
  });

  await test('4. SUSPENDED -> ACTIVE restores student status', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { student, historyEntry } = await changeStudentStatus(studentRecord.id, {
      newStatus: 'ACTIVE',
      effectiveDate: today,
      reason: 'Suspension lifted early following review',
      changedByUserId: 'test-admin-id',
    });

    assert.strictEqual(student.status, 'ACTIVE');
    assert.strictEqual(student.suspensionEndDate, null);
    assert.strictEqual(historyEntry.fromStatus, 'SUSPENDED');
    assert.strictEqual(historyEntry.toStatus, 'ACTIVE');
  });

  await test('5. ACTIVE student is eligible for attendance marking', async () => {
    const elig = await checkStudentEligibility(studentRecord.id, 'ATTENDANCE_MARK');
    assert.strictEqual(elig.eligible, true);
  });

  await test('6. ACTIVE -> WITHDRAWN closes active enrollment record and sets departure reason', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { student, historyEntry } = await changeStudentStatus(studentRecord.id, {
      newStatus: 'WITHDRAWN',
      effectiveDate: today,
      reason: 'Family relocated to another region',
      changedByUserId: 'test-admin-id',
    });

    assert.strictEqual(student.status, 'WITHDRAWN');
    assert.strictEqual(historyEntry.toStatus, 'WITHDRAWN');

    const enr = await prisma.studentAcademicYearRecord.findFirst({
      where: { studentId: studentRecord.id, academicYearId: testAY.id },
    });
    assert.ok(enr.effectiveEndDate !== null, 'effectiveEndDate must be set upon departure');
    assert.ok(enr.departureReason.includes('WITHDRAWN'));
  });

  await test('7. WITHDRAWN student is blocked from new attendance and marks', async () => {
    const attElig = await checkStudentEligibility(studentRecord.id, 'ATTENDANCE_MARK');
    assert.strictEqual(attElig.eligible, false);

    const markElig = await checkStudentEligibility(studentRecord.id, 'MARK_ENTRY');
    assert.strictEqual(markElig.eligible, false);
  });

  await test('8. WITHDRAWN student retains historical report card viewing', async () => {
    const reportElig = await checkStudentEligibility(studentRecord.id, 'REPORT_VIEW');
    assert.strictEqual(reportElig.eligible, true);
    assert.strictEqual(reportElig.isHistoricalAccess, true);
  });

  await test('9. Re-enroll former WITHDRAWN student creates new enrollment and restores ACTIVE status', async () => {
    const reEnrolled = await reEnrollStudent(
      studentRecord.id,
      testAY.id,
      testGrade.id,
      testSection.id,
      null,
      'test-registrar-id'
    );

    assert.ok(reEnrolled);
    const refreshed = await prisma.student.findUnique({ where: { id: studentRecord.id } });
    assert.strictEqual(refreshed.status, 'ACTIVE');

    const history = await getStudentStatusHistory(studentRecord.id);
    assert.ok(history.length >= 3, 'Should have complete chronological history');
  });

  await test('10. ACTIVE -> ARCHIVED locks student record permanently', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { student } = await changeStudentStatus(studentRecord.id, {
      newStatus: 'ARCHIVED',
      effectiveDate: today,
      reason: 'Administrative record archiving',
      changedByUserId: 'test-admin-id',
    });

    assert.strictEqual(student.status, 'ARCHIVED');
  });

  await test('11. ARCHIVED student cannot transition to any other status (terminal state)', async () => {
    let errorThrown = false;
    try {
      await changeStudentStatus(studentRecord.id, {
        newStatus: 'ACTIVE',
        effectiveDate: new Date().toISOString().split('T')[0],
        reason: 'Attempt invalid unarchive',
        changedByUserId: 'test-admin-id',
      });
    } catch (e) {
      errorThrown = true;
      assert.ok(e.message.includes('terminal status') || e.message.includes('permanent status') || e.message.includes('Invalid status transition'));
    }
    assert.ok(errorThrown, 'ARCHIVED must reject any new status transition');
  });

  console.log('\n--- Cleanup ---');
  await prisma.studentStatusHistory.deleteMany({ where: { studentId: studentRecord.id } });
  await prisma.studentAcademicYearRecord.deleteMany({ where: { studentId: studentRecord.id } });
  await prisma.student.delete({ where: { id: studentRecord.id } });
  console.log('Cleaned up test student and associated lifecycle records.');

  console.log('\n====================================================');
  console.log(`E2E Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((e) => {
  console.error('E2E uncaught error:', e);
  process.exit(1);
});

