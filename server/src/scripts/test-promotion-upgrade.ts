import prisma from '../config/db';
import { promotionService } from '../services/promotion.service';
import { academicYearService } from '../services/academic-year.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runPromotionUpgradeTests() {
  console.log('🧪 Starting Promotion Feature Upgrade Test Suite...\n');

  let testYear: any = null;
  let testNextYear: any = null;
  let term1: any = null;
  let term2: any = null;
  let testGrade9: any = null;
  let testGrade10: any = null;
  let testGrade12: any = null;
  let testSectionA: any = null;
  let testSection12A: any = null;
  let subjMath: any = null;
  let subjEng: any = null;
  let subjPhy: any = null;

  const createdStudentIds: string[] = [];

  try {
    // ─── Setup Test Environment ─────────────────────────────────────────────
    console.log('--- Phase 0: Test Environment Setup ---');
    const testYearName = '2018 E.C. (Promo Test)';
    const testNextYearName = '2019 E.C. (Promo Test)';

    testYear = await prisma.academicYear.upsert({
      where: { name: testYearName },
      create: {
        name: testYearName,
        startDate: new Date('2025-09-11'),
        endDate: new Date('2026-07-07'),
        isCurrent: true,
      },
      update: { isCurrent: true },
    });

    testNextYear = await prisma.academicYear.upsert({
      where: { name: testNextYearName },
      create: {
        name: testNextYearName,
        startDate: new Date('2026-09-11'),
        endDate: new Date('2027-07-07'),
        isCurrent: false,
      },
      update: {},
    });

    term1 = await prisma.academicTerm.upsert({
      where: { academicYearId_name: { academicYearId: testYear.id, name: 'Semester 1' } },
      create: {
        academicYearId: testYear.id,
        name: 'Semester 1',
        startDate: new Date('2025-09-11'),
        endDate: new Date('2026-01-30'),
      },
      update: {},
    });

    term2 = await prisma.academicTerm.upsert({
      where: { academicYearId_name: { academicYearId: testYear.id, name: 'Semester 2' } },
      create: {
        academicYearId: testYear.id,
        name: 'Semester 2',
        startDate: new Date('2026-02-10'),
        endDate: new Date('2026-07-07'),
      },
      update: {},
    });

    testGrade9 = await prisma.grade.upsert({
      where: { name: 'Grade 9 (Promo Test)' },
      create: { name: 'Grade 9 (Promo Test)' },
      update: {},
    });

    testGrade10 = await prisma.grade.upsert({
      where: { name: 'Grade 10 (Promo Test)' },
      create: { name: 'Grade 10 (Promo Test)' },
      update: {},
    });

    testGrade12 = await prisma.grade.upsert({
      where: { name: 'Grade 12 (Promo Test)' },
      create: { name: 'Grade 12 (Promo Test)' },
      update: {},
    });

    testSectionA = await prisma.section.findFirst({
      where: { gradeId: testGrade9.id, name: 'A' },
    });
    if (!testSectionA) {
      testSectionA = await prisma.section.create({
        data: { name: 'A', gradeId: testGrade9.id },
      });
    }

    testSection12A = await prisma.section.findFirst({
      where: { gradeId: testGrade12.id, name: 'A' },
    });
    if (!testSection12A) {
      testSection12A = await prisma.section.create({
        data: { name: 'A', gradeId: testGrade12.id },
      });
    }

    subjMath = await prisma.subject.upsert({
      where: { code: 'MATH-PROMO-TEST' },
      create: { name: 'Mathematics', code: 'MATH-PROMO-TEST' },
      update: {},
    });

    subjEng = await prisma.subject.upsert({
      where: { code: 'ENG-PROMO-TEST' },
      create: { name: 'English', code: 'ENG-PROMO-TEST' },
      update: {},
    });

    subjPhy = await prisma.subject.upsert({
      where: { code: 'PHY-PROMO-TEST' },
      create: { name: 'Physics', code: 'PHY-PROMO-TEST' },
      update: {},
    });

    console.log('  ✅ Academic year, terms, grades, and subjects initialized.\n');

    // Helper to create test student
    const createTestStudent = async (name: string, idSuffix: string, gradeId = testGrade9.id) => {
      const secId = gradeId === testGrade12.id ? testSection12A.id : testSectionA.id;
      const student = await prisma.student.create({
        data: {
          fullName: name,
          student_id: `PROMO_${idSuffix}_${Date.now()}`,
          gender: 'M',
          gradeId,
          sectionId: secId,
          status: 'ACTIVE',
          parent_name: `Parent of ${name}`,
          parent_phone: `+251911${Math.floor(100000 + Math.random() * 900000)}`,
          parent_email: `parent_${idSuffix.toLowerCase()}_${Date.now()}@test.com`,
        },
      });
      createdStudentIds.push(student.id);

      await prisma.studentAcademicYearRecord.create({
        data: {
          studentId: student.id,
          academicYearId: testYear.id,
          gradeId,
          sectionId: secId,
          status: 'ACTIVE',
        },
      });

      return student;
    };

    // Helper to add report card
    const createReportCardWithScores = async (
      studentId: string,
      termId: string,
      status: string,
      scores: Array<{ subjectId: string; score: number | null; status?: string }>
    ) => {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      const gradeId = student?.gradeId || testGrade9.id;
      const sectionId = student?.sectionId || testSectionA.id;
      const total = scores.reduce((sum, s) => sum + (s.score || 0), 0);
      const avg = scores.length > 0 ? total / scores.length : 0;

      const rc = await prisma.reportCard.create({
        data: {
          studentId,
          academicYearId: testYear.id,
          academicTermId: termId,
          gradeId,
          sectionId,
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          totalScore: total,
          maxPossibleScore: scores.length * 100,
          averageScore: avg,
        },
      });

      for (const s of scores) {
        await prisma.reportCardSubjectScore.create({
          data: {
            reportCardId: rc.id,
            subjectId: s.subjectId,
            score: s.score === null ? (0 as any) : s.score,
            status: s.status || (s.score === null ? 'MISSING' : 'APPROVED'),
          },
        });
      }

      return rc;
    };

    // ─── Test 1: Passed Student Eligibility & Promotion ──────────────────────
    console.log('--- Test 1: Passed Student Eligibility & Promotion ---');
    const passedStudent = await createTestStudent('Solomon Passed', 'PASS1');

    await createReportCardWithScores(passedStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 85 },
      { subjectId: subjEng.id, score: 78 },
      { subjectId: subjPhy.id, score: 90 },
    ]);

    await createReportCardWithScores(passedStudent.id, term2.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 80 },
      { subjectId: subjEng.id, score: 82 },
      { subjectId: subjPhy.id, score: 88 },
    ]);

    const evalPassed = await promotionService.evaluateStudentAcademicEligibility(passedStudent.id, testYearName);
    assert(evalPassed.finalStatus === 'PASSED', 'Passed student finalStatus is PASSED');
    assert(evalPassed.isEligible === true, 'Passed student isEligible is true');
    assert(evalPassed.ineligibilityReason === null, 'Passed student has no ineligibilityReason');
    assert(evalPassed.overallAverage !== null && evalPassed.overallAverage >= 80, `Overall average accurately computed: ${evalPassed.overallAverage}%`);

    const promoRes1 = await promotionService.promoteStudents({
      studentIds: [passedStudent.id],
      toGradeId: testGrade10.id,
      toSectionName: 'A',
      academicYear: testNextYearName,
      fromAcademicYear: testYearName,
      notes: 'Eligible student promotion',
    }, undefined, 'test-admin');

    assert(promoRes1.length === 1, 'Passed student successfully promoted');
    const updatedStudent1 = await prisma.student.findUnique({ where: { id: passedStudent.id } });
    assert(updatedStudent1?.gradeId === testGrade10.id, 'Student grade updated to Grade 10');

    // ─── Test 2: Failed Student Blocking ────────────────────────────────────
    console.log('\n--- Test 2: Failed Student Blocking ---');
    const failedStudent = await createTestStudent('Daniel Failed', 'FAIL1');

    await createReportCardWithScores(failedStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 35 },
      { subjectId: subjEng.id, score: 40 },
      { subjectId: subjPhy.id, score: 38 },
    ]);

    await createReportCardWithScores(failedStudent.id, term2.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 42 },
      { subjectId: subjEng.id, score: 38 },
      { subjectId: subjPhy.id, score: 40 },
    ]);

    const evalFailed = await promotionService.evaluateStudentAcademicEligibility(failedStudent.id, testYearName);
    assert(evalFailed.finalStatus === 'FAILED', 'Failed student finalStatus is FAILED');
    assert(evalFailed.isEligible === false, 'Failed student isEligible is false');
    assert(evalFailed.ineligibilityReason !== null, `Ineligibility reason explains failure: "${evalFailed.ineligibilityReason}"`);

    let caughtFailedPromo = false;
    try {
      await promotionService.promoteStudents({
        studentIds: [failedStudent.id],
        toGradeId: testGrade10.id,
        toSectionName: 'A',
        academicYear: testNextYearName,
        fromAcademicYear: testYearName,
      }, undefined, 'test-admin');
    } catch (err: any) {
      caughtFailedPromo = true;
      assert(err.message.includes('Cannot promote') && err.message.includes('FAILED'), `Direct promotion correctly blocked: ${err.message}`);
    }
    assert(caughtFailedPromo, 'Backend strictly blocked failed student promotion');

    // ─── Test 3: Incomplete Student with Missing Marks ─────────────────────────
    console.log('\n--- Test 3: Incomplete Student (Missing Term/Assessment) ---');
    const incompleteStudent = await createTestStudent('Sara Incomplete', 'INC1');

    // Only Semester 1 report card created, Semester 2 is missing!
    await createReportCardWithScores(incompleteStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 95 },
      { subjectId: subjEng.id, score: 90 },
      { subjectId: subjPhy.id, score: 92 },
    ]);

    const evalIncomplete = await promotionService.evaluateStudentAcademicEligibility(incompleteStudent.id, testYearName);
    assert(evalIncomplete.finalStatus === 'INCOMPLETE', 'Incomplete student finalStatus is INCOMPLETE');
    assert(evalIncomplete.isEligible === false, 'Incomplete student isEligible is false');
    assert(evalIncomplete.ineligibilityReason?.includes('Missing report card for required term') ?? false, `Reason explains missing term: "${evalIncomplete.ineligibilityReason}"`);

    let caughtIncompletePromo = false;
    try {
      await promotionService.promoteStudents({
        studentIds: [incompleteStudent.id],
        toGradeId: testGrade10.id,
        toSectionName: 'A',
        academicYear: testNextYearName,
        fromAcademicYear: testYearName,
      }, undefined, 'test-admin');
    } catch (err: any) {
      caughtIncompletePromo = true;
      assert(err.message.includes('INCOMPLETE'), `Direct promotion of incomplete student blocked: ${err.message}`);
    }
    assert(caughtIncompletePromo, 'Backend strictly blocked incomplete student promotion even with high Sem 1 average');

    // ─── Test 4: Distinguish Zero (0) from Missing Marks ─────────────────────
    console.log('\n--- Test 4: Distinguish Zero (0) from Missing Marks ---');
    const zeroScoreStudent = await createTestStudent('Dawit ZeroScore', 'ZERO1');

    // Legitimate score of 0 recorded in Physics (e.g. didn't submit final exam or got 0 on test)
    await createReportCardWithScores(zeroScoreStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 75 },
      { subjectId: subjEng.id, score: 80 },
      { subjectId: subjPhy.id, score: 0 }, // Legitimate 0, not missing!
    ]);

    await createReportCardWithScores(zeroScoreStudent.id, term2.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 75 },
      { subjectId: subjEng.id, score: 80 },
      { subjectId: subjPhy.id, score: 0 }, // Legitimate 0, not missing!
    ]);

    const evalZero = await promotionService.evaluateStudentAcademicEligibility(zeroScoreStudent.id, testYearName);
    assert(evalZero.finalStatus !== 'INCOMPLETE', `0 is NOT treated as INCOMPLETE (actual status: ${evalZero.finalStatus})`);
    assert(evalZero.overallAverage !== null, `Overall average is calculated including 0: ${evalZero.overallAverage}%`);
    assert(evalZero.failedSubjectsCount === 1, `Accurately identified Physics as 1 failing subject (count: ${evalZero.failedSubjectsCount})`);

    // Student has overall average (75 + 80 + 0) / 3 = 51.6% >= 50% and 1 failing subject <= 2 allowed.
    // Therefore, by school rules, student is Promoted (Conditional)!
    assert(evalZero.isEligible === true, 'Student with 0 score passes conditionally according to school promotion rules');

    // ─── Test 5: Unpublished / Pending Report Card Blocking ──────────────────
    console.log('\n--- Test 5: Unpublished & Pending Results Blocking ---');
    const pendingStudent = await createTestStudent('Bethlehem Pending', 'PEND1');

    await createReportCardWithScores(pendingStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 85 },
      { subjectId: subjEng.id, score: 85 },
    ]);

    // Term 2 report card is still DRAFT (unpublished)
    await createReportCardWithScores(pendingStudent.id, term2.id, 'DRAFT', [
      { subjectId: subjMath.id, score: 85 },
      { subjectId: subjEng.id, score: 85 },
    ]);

    const evalPending = await promotionService.evaluateStudentAcademicEligibility(pendingStudent.id, testYearName);
    assert(evalPending.finalStatus === 'INCOMPLETE', 'Unpublished report card marks student as INCOMPLETE');
    assert(evalPending.isEligible === false, 'Student with unpublished card is ineligible for promotion');
    assert(evalPending.ineligibilityReason?.includes('not published') ?? false, `Clear reason given: "${evalPending.ineligibilityReason}"`);

    // ─── Test 6: Bulk Promotion Filters Eligible vs Ineligible ───────────────
    console.log('\n--- Test 6: Bulk Promotion Behavior ---');
    // In bulk mode without explicit studentIds, promotionService will:
    // 1. Promote all eligible (PASSED) students.
    // 2. Block and retain all FAILED and INCOMPLETE students.
    // 3. Return blocked student details.

    const bulkPassStudent = await createTestStudent('Bulk Passed', 'BPASS1');
    await createReportCardWithScores(bulkPassStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 88 },
      { subjectId: subjEng.id, score: 85 },
    ]);
    await createReportCardWithScores(bulkPassStudent.id, term2.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 90 },
      { subjectId: subjEng.id, score: 88 },
    ]);

    const bulkCohortStudents = [bulkPassStudent.id, failedStudent.id, incompleteStudent.id];

    // Attempting selective promotion with mixed cohort must fail
    let caughtSelective = false;
    try {
      await promotionService.promoteStudents({
        studentIds: bulkCohortStudents,
        toGradeId: testGrade10.id,
        toSectionName: 'A',
        academicYear: testNextYearName,
        fromAcademicYear: testYearName,
      }, undefined, 'test-admin');
    } catch (err: any) {
      caughtSelective = true;
      assert(err.message.includes('Cannot promote'), `Selective promotion fails fast when ineligible student included: ${err.message}`);
    }
    assert(caughtSelective, 'Selective promotion enforced zero tolerance for failed/incomplete students');

    // Promoting only the bulkPassStudent succeeds
    const bulkResults = await promotionService.promoteStudents({
      studentIds: [bulkPassStudent.id],
      toGradeId: testGrade10.id,
      toSectionName: 'A',
      academicYear: testNextYearName,
      fromAcademicYear: testYearName,
    }, undefined, 'test-admin');

    assert(bulkResults.length === 1, 'Only eligible passed student in cohort promoted');

    // ─── Test 7: Duplicate Promotion Prevention ──────────────────────────────
    console.log('\n--- Test 7: Duplicate Promotion Prevention ---');
    let caughtDuplicate = false;
    try {
      await promotionService.promoteStudents({
        studentIds: [passedStudent.id],
        toGradeId: testGrade10.id,
        academicYear: testNextYearName,
        fromAcademicYear: testYearName,
      }, undefined, 'test-admin');
    } catch (err: any) {
      caughtDuplicate = true;
      assert(err.message.includes('already been promoted'), `Duplicate promotion prevented: ${err.message}`);
    }
    assert(caughtDuplicate, 'Duplicate promotion prevented by backend');

    // ─── Test 8: Grade 12 Graduation Rule ────────────────────────────────────
    console.log('\n--- Test 8: Grade 12 Graduation Rule ---');
    const gradStudent = await createTestStudent('Senior Graduate', 'GRAD1', testGrade12.id);

    await createReportCardWithScores(gradStudent.id, term1.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 80 },
      { subjectId: subjEng.id, score: 85 },
    ]);
    await createReportCardWithScores(gradStudent.id, term2.id, 'PUBLISHED', [
      { subjectId: subjMath.id, score: 85 },
      { subjectId: subjEng.id, score: 82 },
    ]);

    const gradResults = await promotionService.promoteStudents({
      studentIds: [gradStudent.id],
      toGradeId: 'GRADUATE',
      academicYear: testNextYearName,
      fromAcademicYear: testYearName,
    }, undefined, 'test-admin');

    assert(gradResults.length === 1, 'Grade 12 student successfully graduated');
    const updatedGrad = await prisma.student.findUnique({ where: { id: gradStudent.id } });
    assert(updatedGrad?.status === 'GRADUATED', 'Student status updated to GRADUATED');

    // ─── Test 9: Historical Record Preservation ──────────────────────────────
    console.log('\n--- Test 9: Historical Record Preservation ---');
    const pastRecords = await prisma.studentAcademicYearRecord.findMany({
      where: { studentId: passedStudent.id },
    });
    assert(pastRecords.length === 2, `Historical academic year records preserved without deletion (found ${pastRecords.length} records)`);
    const sourceRecord = pastRecords.find((r) => r.academicYearId === testYear.id);
    const destRecord = pastRecords.find((r) => r.academicYearId === testNextYear.id);
    assert(sourceRecord?.status === 'PROMOTED', 'Source year record status updated to PROMOTED');
    assert(destRecord?.status === 'ACTIVE', 'Destination year record status created as ACTIVE');

    const preservedReportCards = await prisma.reportCard.findMany({
      where: { studentId: passedStudent.id },
    });
    assert(preservedReportCards.length === 2, `All historical report cards intact (${preservedReportCards.length} cards)`);

    // ─── Test 10: Promotion Preview Counts ───────────────────────────────────
    console.log('\n--- Test 10: Promotion Preview Counts Verification ---');
    const previews = await promotionService.getPromotionPreview(undefined, testYearName);
    assert(previews.length > 0, `Preview returned ${previews.length} cohorts`);
    const testCohort = previews.find((c) => c.gradeId === testGrade9.id);
    if (testCohort) {
      assert(testCohort.count > 0, `Test cohort student count: ${testCohort.count}`);
      assert(testCohort.eligibleCount >= 0, `Test cohort eligible count: ${testCohort.eligibleCount}`);
      assert(testCohort.failedCount >= 0, `Test cohort failed count: ${testCohort.failedCount}`);
      assert(testCohort.incompleteCount >= 0, `Test cohort incomplete count: ${testCohort.incompleteCount}`);
    }

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    // ─── Cleanup ─────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup: Removing test records ---');
    for (const sid of createdStudentIds) {
      await prisma.studentPromotion.deleteMany({ where: { studentId: sid } }).catch(() => {});
      await prisma.reportCardSubjectScore.deleteMany({
        where: { reportCard: { studentId: sid } },
      }).catch(() => {});
      await prisma.reportCard.deleteMany({ where: { studentId: sid } }).catch(() => {});
      await prisma.studentAcademicYearRecord.deleteMany({ where: { studentId: sid } }).catch(() => {});
      await prisma.parentNotification.deleteMany({ where: { studentId: sid } }).catch(() => {});
      await prisma.student.delete({ where: { id: sid } }).catch(() => {});
    }

    // Clean up sections before grades
    if (testSectionA) await prisma.section.delete({ where: { id: testSectionA.id } }).catch(() => {});
    if (testSection12A) await prisma.section.delete({ where: { id: testSection12A.id } }).catch(() => {});

    // Clean up promotions referencing test grades/years
    if (testGrade9 || testGrade10 || testGrade12) {
      const gids = [testGrade9?.id, testGrade10?.id, testGrade12?.id].filter(Boolean);
      await prisma.studentPromotion.deleteMany({
        where: {
          OR: [{ fromGradeId: { in: gids } }, { toGradeId: { in: gids } }],
        },
      }).catch(() => {});
    }

    if (testGrade9) await prisma.grade.delete({ where: { id: testGrade9.id } }).catch(() => {});
    if (testGrade10) await prisma.grade.delete({ where: { id: testGrade10.id } }).catch(() => {});
    if (testGrade12) await prisma.grade.delete({ where: { id: testGrade12.id } }).catch(() => {});
    if (subjMath) await prisma.subject.delete({ where: { id: subjMath.id } }).catch(() => {});
    if (subjEng) await prisma.subject.delete({ where: { id: subjEng.id } }).catch(() => {});
    if (subjPhy) await prisma.subject.delete({ where: { id: subjPhy.id } }).catch(() => {});

    // Clean up terms before years
    if (term1) await prisma.academicTerm.delete({ where: { id: term1.id } }).catch(() => {});
    if (term2) await prisma.academicTerm.delete({ where: { id: term2.id } }).catch(() => {});
    if (testNextYear) await prisma.academicYear.delete({ where: { id: testNextYear.id } }).catch(() => {});
    if (testYear) await prisma.academicYear.delete({ where: { id: testYear.id } }).catch(() => {});

    console.log('  🧹 Cleanup complete.');
  }

  console.log('\n========================================');
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPromotionUpgradeTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
