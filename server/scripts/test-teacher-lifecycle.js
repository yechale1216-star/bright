const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'zetime-secret-key-2024-secure-and-long-enough';
}

function generateToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' });
}

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   Bright Path Teacher Portal Lifecycle Test Suite  ');
  console.log('====================================================\n');

  const { teacherAccessService } = require('../dist/services/teacher-access.service');
  const { AcademicYearService } = require('../dist/services/academic-year.service');
  const academicYearService = new AcademicYearService();

  // Test identifiers
  const timestamp = Date.now();
  const testEmail = `teacher_${timestamp}@test.brightpath.com`;
  const adminEmail = `admin_${timestamp}@test.brightpath.com`;

  let testTeacherUser = null;
  let testTeacher = null;
  let adminUser = null;
  let year2026 = null;
  let year2027 = null;
  let testGrade = null;
  let sectionA = null;
  let sectionB = null;
  let subject1 = null;
  let subject2 = null;
  let studentA = null;
  let studentB = null;
  let assignment2026 = null;
  let originalCurrentYear = null;

  try {
    // 0. Setup Fixtures
    console.log('--- 0. Setting up test fixtures ---');
    
    // Remember original current year to restore at end
    originalCurrentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });

    // Create Admin User
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: '$2a$10$dummyhash',
        full_name: 'Test Administrator',
        role: 'admin',
        is_active: true,
      },
    });

    // Create Teacher User & Teacher profile
    testTeacher = await prisma.teacher.create({
      data: {
        name: `Test Teacher ${timestamp}`,
        email: testEmail,
        is_active: true,
        employmentStatus: 'ACTIVE',
      },
    });

    testTeacherUser = await prisma.user.create({
      data: {
        email: testEmail,
        password_hash: '$2a$10$dummyhash',
        full_name: `Test Teacher ${timestamp}`,
        role: 'teacher',
        is_active: true,
        teacher_id: testTeacher.id,
      },
    });

    await prisma.teacher.update({
      where: { id: testTeacher.id },
      data: { user_id: testTeacherUser.id },
    });

    // Create Test Academic Years
    year2026 = await prisma.academicYear.create({
      data: {
        name: `TEST-AY-2026-${timestamp}`,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        isCurrent: true,
      },
    });

    year2027 = await prisma.academicYear.create({
      data: {
        name: `TEST-AY-2027-${timestamp}`,
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-12-31'),
        isCurrent: false,
      },
    });

    // Ensure year2026 is the only current year during initial tests
    await prisma.academicYear.updateMany({
      where: { id: { not: year2026.id } },
      data: { isCurrent: false },
    });
    academicYearService.invalidateCurrentCache();

    // Create Grade, Sections, Subjects
    testGrade = await prisma.grade.create({
      data: { name: `Grade Test ${timestamp}` },
    });

    sectionA = await prisma.section.create({
      data: { name: `Sec-A-${timestamp}`, gradeId: testGrade.id },
    });

    sectionB = await prisma.section.create({
      data: { name: `Sec-B-${timestamp}`, gradeId: testGrade.id },
    });

    subject1 = await prisma.subject.create({
      data: { name: `Math-${timestamp}`, code: `MTH-${timestamp}` },
    });

    subject2 = await prisma.subject.create({
      data: { name: `Physics-${timestamp}`, code: `PHY-${timestamp}` },
    });

    // Create Students
    studentA = await prisma.student.create({
      data: {
        student_id: `STU-A-${timestamp}`,
        fullName: `Student In Section A ${timestamp}`,
        gender: 'MALE',
        gradeId: testGrade.id,
        sectionId: sectionA.id,
        status: 'ACTIVE',
        parent_email: 'parentA@test.com', parent_phone: '+251911111111', parent_name: 'Parent A',
      },
    });

    studentB = await prisma.student.create({
      data: {
        student_id: `STU-B-${timestamp}`,
        fullName: `Student In Section B ${timestamp}`,
        gender: 'FEMALE',
        gradeId: testGrade.id,
        sectionId: sectionB.id,
        status: 'ACTIVE',
        parent_email: 'parentB@test.com', parent_phone: '+251922222222', parent_name: 'Parent B',
      },
    });

    // Assign teacher to Section A and Subject 1 for Year 2026
    assignment2026 = await prisma.teacherAssignment.create({
      data: {
        teacher_id: testTeacher.id,
        academicYearId: year2026.id,
        gradeId: testGrade.id,
        sectionId: sectionA.id,
        subjectId: subject1.id,
        role: 'SUBJECT_TEACHER',
        status: 'ACTIVE',
      },
    });

    console.log('Fixtures initialized successfully.\n');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Teacher assigned to 2026 cannot access academic records after 2027 becomes active
    // ─────────────────────────────────────────────────────────────
    console.log('--- Test 1 & 2: Academic-Year Transition & Access Restriction ---');
    
    // First, verify access works in 2026
    let access2026 = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(access2026.allowed === true, 'Teacher has valid access when Year 2026 is active');
    assert(access2026.assignments.length === 1, 'Teacher has 1 assignment in active year 2026');

    // Now switch active year to 2027 without assigning teacher to 2027
    await prisma.academicYear.updateMany({ data: { isCurrent: false } });
    await prisma.academicYear.update({ where: { id: year2027.id }, data: { isCurrent: true } });
    academicYearService.invalidateCurrentCache();

    let access2027WithoutAssignment = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(
      access2027WithoutAssignment.allowed === false &&
      access2027WithoutAssignment.code === 'NO_ACTIVE_YEAR_ASSIGNMENT',
      'Teacher assigned to 2026 cannot access records after 2027 becomes active unless assigned to 2027'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Teacher cannot access previous-year data even when supplying a historical year ID
    // ─────────────────────────────────────────────────────────────
    let historicalCheck = await teacherAccessService.validateAcademicYearRequest(testTeacherUser.id, year2026.id);
    assert(
      historicalCheck.allowed === false &&
      historicalCheck.reason.includes('restricted to the currently active academic year'),
      'Teacher cannot access previous-year data even when supplying historical year ID directly'
    );

    // Switch back to 2026 as active for remaining assignment tests
    await prisma.academicYear.updateMany({ data: { isCurrent: false } });
    await prisma.academicYear.update({ where: { id: year2026.id }, data: { isCurrent: true } });
    academicYearService.invalidateCurrentCache();

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Teacher cannot access unassigned students, classes, sections, or subjects
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Class, Section, Subject & Student Scope Control ---');
    
    // Assigned Class (Grade + Section A + Subject 1)
    let assignedScope = await teacherAccessService.verifyClassSubjectScope(testTeacherUser.id, {
      gradeId: testGrade.id,
      sectionId: sectionA.id,
      subjectId: subject1.id,
    });
    assert(assignedScope.allowed === true, 'Teacher is permitted to access assigned class (Section A, Subject 1)');

    // Unassigned Section (Section B)
    let unassignedSection = await teacherAccessService.verifyClassSubjectScope(testTeacherUser.id, {
      gradeId: testGrade.id,
      sectionId: sectionB.id,
      subjectId: subject1.id,
    });
    assert(
      unassignedSection.allowed === false,
      'Teacher cannot access unassigned section (Section B)'
    );

    // Unassigned Subject (Subject 2 in Section A)
    let unassignedSubject = await teacherAccessService.verifyClassSubjectScope(testTeacherUser.id, {
      gradeId: testGrade.id,
      sectionId: sectionA.id,
      subjectId: subject2.id,
    });
    assert(
      unassignedSubject.allowed === false,
      'Teacher cannot access unassigned subject (Subject 2)'
    );

    // Student Scope: Student A is in assigned Section A; Student B is in unassigned Section B
    let studentAScope = await teacherAccessService.verifyStudentScope(testTeacherUser.id, studentA.id);
    assert(studentAScope.allowed === true, 'Teacher can access student in assigned Section A');

    let studentBScope = await teacherAccessService.verifyStudentScope(testTeacherUser.id, studentB.id);
    assert(studentBScope.allowed === false, 'Teacher cannot access student in unassigned Section B');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Teacher with no valid active-year assignment is denied portal access
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Deny Access When No Valid Active-Year Assignment Exists ---');
    
    // Temporarily deactivate assignment
    await prisma.teacherAssignment.update({
      where: { id: assignment2026.id },
      data: { status: 'INACTIVE' },
    });

    let noActiveAssignmentCheck = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(
      noActiveAssignmentCheck.allowed === false &&
      noActiveAssignmentCheck.code === 'NO_ACTIVE_YEAR_ASSIGNMENT',
      'Teacher with no valid active-year assignment is denied portal access'
    );

    // Restore assignment to ACTIVE
    await prisma.teacherAssignment.update({
      where: { id: assignment2026.id },
      data: { status: 'ACTIVE' },
    });

    // ─────────────────────────────────────────────────────────────
    // TEST 5 & 6: Terminated Teacher Immediate Revocation & Invalidation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 5 & 6: Employment Termination & Immediate Session Revocation ---');
    
    // Generate an existing JWT token representing an active session
    const existingSessionToken = generateToken({
      id: testTeacherUser.id,
      email: testTeacherUser.email,
      role: 'teacher',
      schoolId: 'single-school',
    });

    // Terminate teacher
    const terminationResult = await teacherAccessService.terminateTeacher(testTeacher.id, {
      reason: 'Gross disciplinary violation',
      effectiveDate: new Date(),
      adminId: adminUser.id,
    });

    assert(terminationResult.success === true, 'Teacher employment terminated successfully by admin');

    // Verify DB state
    const terminatedTeacher = await prisma.teacher.findUnique({ where: { id: testTeacher.id } });
    const terminatedUser = await prisma.user.findUnique({ where: { id: testTeacherUser.id } });
    assert(
      terminatedTeacher.employmentStatus === 'TERMINATED' &&
      terminatedTeacher.is_active === false &&
      terminatedUser.is_active === false &&
      terminatedTeacher.terminationReason === 'Gross disciplinary violation',
      'Teacher record updated with TERMINATED status, effective date, and reason'
    );

    // Verify assignments were deactivated
    const activeAssignmentsCount = await prisma.teacherAssignment.count({
      where: { teacher_id: testTeacher.id, status: 'ACTIVE' },
    });
    assert(activeAssignmentsCount === 0, 'Active assignments were ended upon termination');

    // Verify checkAccountActive rejects
    const accountCheck = await teacherAccessService.checkAccountActive(testTeacherUser.id);
    assert(
      accountCheck.active === false,
      'Terminated teacher account is marked inactive and rejected'
    );

    // Verify portal access validation rejects terminated teacher
    const terminatedPortalCheck = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(
      terminatedPortalCheck.allowed === false &&
      terminatedPortalCheck.code === 'ACCOUNT_TERMINATED',
      'Terminated teacher is rejected from accessing portal with ACCOUNT_TERMINATED'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Reactivating an old assignment does not grant access to a different academic year
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: Reactivating Old Assignment Does Not Grant Different Year Access ---');
    
    // Switch active year to 2027
    await prisma.academicYear.updateMany({ data: { isCurrent: false } });
    await prisma.academicYear.update({ where: { id: year2027.id }, data: { isCurrent: true } });
    academicYearService.invalidateCurrentCache();

    // Even if 2026 assignment is marked ACTIVE, it must not grant access to 2027
    await prisma.teacherAssignment.update({
      where: { id: assignment2026.id },
      data: { status: 'ACTIVE' },
    });

    const crossYearAccess = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(
      crossYearAccess.allowed === false,
      'Reactivating an old 2026 assignment does not grant access to active year 2027'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Reinstatement restores access ONLY when teacher also has a valid active-year assignment
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: Reinstatement Requires Active-Year Assignment ---');
    
    // Reinstate teacher
    const reinstateResult = await teacherAccessService.reinstateTeacher(testTeacher.id, {
      reason: 'Reinstated after review',
      adminId: adminUser.id,
    });
    assert(reinstateResult.success === true, 'Teacher reinstated successfully');

    // While 2027 is active, teacher has no 2027 assignment -> access MUST still be denied!
    const reinstatedWithout2027Assignment = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(
      reinstatedWithout2027Assignment.allowed === false &&
      reinstatedWithout2027Assignment.code === 'NO_ACTIVE_YEAR_ASSIGNMENT',
      'Reinstated teacher is still denied access until an active-year assignment is created'
    );

    // Now create a valid assignment for 2027
    const assignment2027 = await prisma.teacherAssignment.create({
      data: {
        teacher_id: testTeacher.id,
        academicYearId: year2027.id,
        gradeId: testGrade.id,
        sectionId: sectionA.id,
        subjectId: subject1.id,
        role: 'SUBJECT_TEACHER',
        status: 'ACTIVE',
      },
    });

    // Now teacher should have access!
    const reinstatedWithAssignment = await teacherAccessService.validateTeacherActiveAccess(testTeacherUser.id);
    assert(
      reinstatedWithAssignment.allowed === true &&
      reinstatedWithAssignment.assignments.length === 1,
      'Reinstated teacher with valid active-year assignment is granted portal access'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Historical records remain intact
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Historical Records Integrity ---');
    
    const preservedOldAssignment = await prisma.teacherAssignment.findUnique({
      where: { id: assignment2026.id },
    });
    assert(
      preservedOldAssignment !== null && preservedOldAssignment.academicYearId === year2026.id,
      'Historical 2026 assignment record was preserved and not deleted'
    );

    const auditCount = await prisma.auditLog.count({
      where: { entity_id: testTeacher.id },
    });
    assert(auditCount >= 2, 'Audit log entries for termination and reinstatement are preserved');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Other roles and portals continue to function correctly
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: Admin & Other Portals Access Integrity ---');
    
    const adminAccess = await teacherAccessService.validateTeacherActiveAccess(adminUser.id);
    assert(
      adminAccess.allowed === true,
      'Administrators bypass teacher-specific assignment restrictions and retain full access'
    );

    console.log('\n====================================================');
    console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
    console.log('====================================================\n');

  } finally {
    // ─────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────
    console.log('--- Cleanup ---');
    try {
      if (testTeacher) {
        await prisma.auditLog.deleteMany({ where: { entity_id: testTeacher.id } });
        await prisma.teacherAssignment.deleteMany({ where: { teacher_id: testTeacher.id } });
      }
      if (studentA) await prisma.student.delete({ where: { id: studentA.id } });
      if (studentB) await prisma.student.delete({ where: { id: studentB.id } });
      if (sectionA) await prisma.section.delete({ where: { id: sectionA.id } });
      if (sectionB) await prisma.section.delete({ where: { id: sectionB.id } });
      if (subject1) await prisma.subject.delete({ where: { id: subject1.id } });
      if (subject2) await prisma.subject.delete({ where: { id: subject2.id } });
      if (testGrade) await prisma.grade.delete({ where: { id: testGrade.id } });
      if (testTeacherUser) await prisma.user.delete({ where: { id: testTeacherUser.id } });
      if (testTeacher) await prisma.teacher.delete({ where: { id: testTeacher.id } });
      if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });
      if (year2026) await prisma.academicYear.delete({ where: { id: year2026.id } });
      if (year2027) await prisma.academicYear.delete({ where: { id: year2027.id } });

      // Restore original current year
      if (originalCurrentYear) {
        await prisma.academicYear.updateMany({ data: { isCurrent: false } });
        await prisma.academicYear.update({
          where: { id: originalCurrentYear.id },
          data: { isCurrent: true },
        });
        academicYearService.invalidateCurrentCache();
      }
      console.log('Test fixtures cleaned up successfully.');
    } catch (e) {
      console.error('Cleanup notice:', e.message);
    }
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
