/**
 * Automated Verification Test Suite: Active Academic Term Restriction for Teacher Gradebook
 * Tests backend enforcement, date range bounds, term switching, historical viewability,
 * and error messages per specification.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let testResults = [];
function recordResult(testName, passed, details = '') {
  testResults.push({ testName, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${testName}${details ? ` -> ${details}` : ''}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('ACTIVE ACADEMIC TERM GRADEBOOK VERIFICATION SUITE');
  console.log('======================================================\n');

  let testAcademicYear = null;
  let term1 = null;
  let term2 = null;
  let testGrade = null;
  let testSection = null;
  let testSubject = null;
  let testAssessmentActive = null;
  let testAssessmentInactive = null;
  let originalCurrentAY = null;
  let academicYearService = null;

  try {
    const ayModule = require('../dist/services/academic-year.service');
    academicYearService = ayModule.academicYearService;
    const { gradebookService } = require('../dist/services/gradebook.service');
    const { assessmentSubmissionService } = require('../dist/services/assessment-submission.service');

    // ── Setup Test Data ────────────────────────────────────────────────────────
    console.log('--- 1. Setting Up Test Academic Year & Terms ---');
    
    // Remember original current academic year
    originalCurrentAY = await prisma.academicYear.findFirst({ where: { isCurrent: true } });

    // Temporarily mark others as non-current to create isolated test year
    await prisma.academicYear.updateMany({ data: { isCurrent: false } });

    const now = new Date();
    const curYear = now.getFullYear();

    testAcademicYear = await prisma.academicYear.create({
      data: {
        name: `Test AY ${Date.now()}`,
        startDate: new Date(`${curYear}-01-01`),
        endDate: new Date(`${curYear}-12-31`),
        isCurrent: true,
      },
    });

    // Term 1: Active term (startDate 10 days ago, endDate 20 days in future)
    term1 = await prisma.academicTerm.create({
      data: {
        academicYearId: testAcademicYear.id,
        name: 'Term 1 Active',
        startDate: new Date(Date.now() - 10 * 86400000),
        endDate: new Date(Date.now() + 20 * 86400000),
        isCurrent: true,
      },
    });

    // Term 2: Inactive term — also within a valid date window so it can become current
    term2 = await prisma.academicTerm.create({
      data: {
        academicYearId: testAcademicYear.id,
        name: 'Term 2 Inactive',
        startDate: new Date(Date.now() - 5 * 86400000),   // started 5 days ago
        endDate: new Date(Date.now() + 60 * 86400000),   // ends 60 days from now
        isCurrent: false,
      },
    });

    // Invalidate cache
    academicYearService.invalidateCurrentCache();

    // Setup dummy grade, section, subject, student
    testGrade = await prisma.grade.findFirst() || await prisma.grade.create({ data: { name: `G-${Date.now()}`, level: 1 } });
    testSection = await prisma.section.findFirst({ where: { gradeId: testGrade.id } }) || await prisma.section.create({ data: { name: `Sec-A`, gradeId: testGrade.id } });
    testSubject = await prisma.subject.findFirst() || await prisma.subject.create({ data: { name: `Sub-${Date.now()}`, code: `S-${Date.now()}` } });

    testAssessmentActive = await prisma.assessment.create({
      data: {
        title: 'Active Term Quiz',
        academicYearId: testAcademicYear.id,
        academicTermId: term1.id,
        gradeId: testGrade.id,
        sectionId: testSection.id,
        subjectId: testSubject.id,
        maxScore: 20,
        weightage: 10,
        type: 'QUIZ',
        status: 'DRAFT',
      },
    });

    testAssessmentInactive = await prisma.assessment.create({
      data: {
        title: 'Inactive Term Quiz',
        academicYearId: testAcademicYear.id,
        academicTermId: term2.id,
        gradeId: testGrade.id,
        sectionId: testSection.id,
        subjectId: testSubject.id,
        maxScore: 20,
        weightage: 10,
        type: 'QUIZ',
        status: 'DRAFT',
      },
    });

    // ── Test 1: getActiveAcademicTerm returns active term ─────────────────────
    const activeTermRes = await academicYearService.getActiveAcademicTerm(testAcademicYear.id);
    recordResult(
      'getActiveAcademicTerm resolves active term correctly',
      activeTermRes && activeTermRes.id === term1.id,
      `Resolved: ${activeTermRes?.name} (id: ${activeTermRes?.id})`
    );

    // ── Test 2: validateMarkEntryWindow allows mark entry for active term ─────
    const valActive = await academicYearService.validateMarkEntryWindow(term1.id, testAcademicYear.id);
    recordResult(
      'validateMarkEntryWindow permits entry for active term within date range',
      valActive.allowed === true && valActive.activeTerm?.id === term1.id,
      `Allowed: ${valActive.allowed}`
    );

    // ── Test 3: validateMarkEntryWindow rejects inactive term ─────────────────
    const valInactive = await academicYearService.validateMarkEntryWindow(term2.id, testAcademicYear.id);
    recordResult(
      'validateMarkEntryWindow rejects inactive term with TERM_INACTIVE',
      valInactive.allowed === false &&
      valInactive.code === 'TERM_INACTIVE' &&
      valInactive.message === 'Marks can only be entered or modified for the currently active academic term.',
      `Code: ${valInactive.code}, Message: "${valInactive.message}"`
    );

    // ── Test 4: validateMarkEntryWindow rejects when term has ended ───────────
    const pastDate = new Date(Date.now() + 30 * 86400000); // 30 days later, past term1 endDate
    const valEnded = await academicYearService.validateMarkEntryWindow(term1.id, testAcademicYear.id, pastDate);
    recordResult(
      'validateMarkEntryWindow rejects expired term with TERM_ENDED',
      valEnded.allowed === false &&
      valEnded.code === 'TERM_ENDED' &&
      valEnded.message === 'The academic term has ended. Mark entry is no longer available.',
      `Code: ${valEnded.code}, Message: "${valEnded.message}"`
    );

    // ── Test 5: validateMarkEntryWindow rejects when term has not started ─────
    const futureTermDate = new Date(Date.now() - 20 * 86400000); // 20 days ago, before term1 startDate
    const valNotStarted = await academicYearService.validateMarkEntryWindow(term1.id, testAcademicYear.id, futureTermDate);
    recordResult(
      'validateMarkEntryWindow rejects pre-start term with TERM_NOT_STARTED',
      valNotStarted.allowed === false &&
      valNotStarted.code === 'TERM_NOT_STARTED' &&
      valNotStarted.message === 'The academic term has not started yet. Mark entry is not available.',
      `Code: ${valNotStarted.code}, Message: "${valNotStarted.message}"`
    );

    // ── Test 6: validateMarkEntryWindow when no term is marked current ────────
    await prisma.academicTerm.updateMany({
      where: { academicYearId: testAcademicYear.id },
      data: { isCurrent: false },
    });
    academicYearService.invalidateCurrentCache();

    const valNoActive = await academicYearService.validateMarkEntryWindow(term1.id, testAcademicYear.id);
    recordResult(
      'validateMarkEntryWindow rejects with NO_ACTIVE_TERM when none marked isCurrent',
      valNoActive.allowed === false &&
      valNoActive.code === 'NO_ACTIVE_TERM' &&
      valNoActive.message === 'No active academic term is configured. Please contact the school administrator.',
      `Code: ${valNoActive.code}, Message: "${valNoActive.message}"`
    );

    // Restore term1 as current
    await prisma.academicTerm.update({
      where: { id: term1.id },
      data: { isCurrent: true },
    });
    academicYearService.invalidateCurrentCache();

    // ── Test 7: Backend enforcement on saveClassMarks for inactive term ──────
    let saveClassMarksRejected = false;
    let saveClassMarksError = null;
    try {
      await gradebookService.saveClassMarks({
        academicYearId: testAcademicYear.id,
        academicTermId: term2.id, // Inactive term
        gradeId: testGrade.id,
        sectionId: testSection.id,
        subjectId: testSubject.id,
        marks: [],
      });
    } catch (err) {
      saveClassMarksRejected = true;
      saveClassMarksError = err;
    }
    recordResult(
      'saveClassMarks rejects inactive term with 403 and TERM_INACTIVE',
      saveClassMarksRejected && saveClassMarksError?.code === 'TERM_INACTIVE' && saveClassMarksError?.status === 403,
      `Rejected with: ${saveClassMarksError?.code} (status: ${saveClassMarksError?.status})`
    );

    // ── Test 8: Backend enforcement on saveClassMarks for active term ────────
    let saveClassMarksActiveSuccess = false;
    try {
      const res = await gradebookService.saveClassMarks({
        academicYearId: testAcademicYear.id,
        academicTermId: term1.id, // Active term
        gradeId: testGrade.id,
        sectionId: testSection.id,
        subjectId: testSubject.id,
        marks: [],
      });
      saveClassMarksActiveSuccess = res.success === true;
    } catch (err) {
      console.error(err);
    }
    recordResult(
      'saveClassMarks accepts active term within date range',
      saveClassMarksActiveSuccess,
      `Success: ${saveClassMarksActiveSuccess}`
    );

    // ── Test 9: Backend enforcement on saveBulkMarks for inactive assessment ──
    let saveBulkMarksRejected = false;
    let saveBulkMarksError = null;
    try {
      await gradebookService.saveBulkMarks(testAssessmentInactive.id, [
        { studentId: 'dummy-id', score: 15, isAbsent: false },
      ]);
    } catch (err) {
      saveBulkMarksRejected = true;
      saveBulkMarksError = err;
    }
    recordResult(
      'saveBulkMarks rejects assessment belonging to inactive term with 403',
      saveBulkMarksRejected && saveBulkMarksError?.code === 'TERM_INACTIVE' && saveBulkMarksError?.status === 403,
      `Rejected with: ${saveBulkMarksError?.code} (status: ${saveBulkMarksError?.status})`
    );

    // ── Test 10: Backend enforcement on teacherSubmitMarks for inactive term ──
    let submitRejected = false;
    let submitError = null;
    try {
      await assessmentSubmissionService.teacherSubmitMarks({
        academicYearId: testAcademicYear.id,
        academicTermId: term2.id, // Inactive term
        gradeId: testGrade.id,
        sectionId: testSection.id,
        subjectId: testSubject.id,
        teacherId: 'dummy-teacher',
      });
    } catch (err) {
      submitRejected = true;
      submitError = err;
    }
    recordResult(
      'teacherSubmitMarks rejects submission for inactive term with 403',
      submitRejected && submitError?.code === 'TERM_INACTIVE' && submitError?.status === 403,
      `Rejected with: ${submitError?.code} (status: ${submitError?.status})`
    );

    // ── Test 11: Historical viewability via getClassGradebook ────────────────
    const gradebookHistorical = await gradebookService.getClassGradebook({
      academicYearId: testAcademicYear.id,
      academicTermId: term2.id, // Inactive term
      gradeId: testGrade.id,
      sectionId: testSection.id,
      subjectId: testSubject.id,
    });
    recordResult(
      'getClassGradebook permits viewing historical records with termStatus read-only info',
      gradebookHistorical !== null &&
      gradebookHistorical.termStatus?.isMarkEntryAllowed === false &&
      gradebookHistorical.termStatus?.lockCode === 'TERM_INACTIVE' &&
      Array.isArray(gradebookHistorical.assessments),
      `isMarkEntryAllowed: ${gradebookHistorical.termStatus?.isMarkEntryAllowed}, lockCode: ${gradebookHistorical.termStatus?.lockCode}`
    );

    // ── Test 12: Admin switches active term -> immediate cache invalidation ──
    await academicYearService.updateTerm(term2.id, { isCurrent: true });
    
    // Now term2 is active, term1 is inactive!
    const valAfterSwitchTerm2 = await academicYearService.validateMarkEntryWindow(term2.id, testAcademicYear.id);
    const valAfterSwitchTerm1 = await academicYearService.validateMarkEntryWindow(term1.id, testAcademicYear.id);

    recordResult(
      'Switching active term immediately allows new term and rejects previous term',
      valAfterSwitchTerm2.allowed === true &&
      valAfterSwitchTerm1.allowed === false &&
      valAfterSwitchTerm1.code === 'TERM_INACTIVE',
      `Term2 allowed: ${valAfterSwitchTerm2.allowed}, Term1 allowed: ${valAfterSwitchTerm1.allowed} (${valAfterSwitchTerm1.code})`
    );

  } catch (error) {
    console.error('Test execution failed with error:', error);
    recordResult('Complete test run', false, error.message);
  } finally {
    // ── Cleanup Test Data ────────────────────────────────────────────────────
    console.log('\n--- Cleaning Up Test Data ---');
    try {
      if (testAssessmentActive) await prisma.assessment.delete({ where: { id: testAssessmentActive.id } }).catch(() => {});
      if (testAssessmentInactive) await prisma.assessment.delete({ where: { id: testAssessmentInactive.id } }).catch(() => {});
      if (term1) await prisma.academicTerm.delete({ where: { id: term1.id } }).catch(() => {});
      if (term2) await prisma.academicTerm.delete({ where: { id: term2.id } }).catch(() => {});
      if (testAcademicYear) await prisma.academicYear.delete({ where: { id: testAcademicYear.id } }).catch(() => {});
      
      // Restore original current academic year
      if (originalCurrentAY) {
        await prisma.academicYear.update({
          where: { id: originalCurrentAY.id },
          data: { isCurrent: true },
        });
      }
      academicYearService?.invalidateCurrentCache?.();
      console.log('Cleanup complete.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }
    await prisma.$disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log(`SUMMARY: ${testResults.filter(r => r.passed).length}/${testResults.length} TESTS PASSED`);
  console.log('======================================================\n');
  const allPassed = testResults.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

runTests();
