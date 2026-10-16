import prisma from '../src/config/db';
import { gradebookService } from '../src/services/gradebook.service';
import { assessmentSubmissionService } from '../src/services/assessment-submission.service';

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING REPORT CARD APPROVAL & PUBLICATION WORKFLOW TESTS');
  console.log('========================================================\n');

  const gradeId = '94d5b1d0-bb43-4a46-b60c-2ef203de8310'; // Grade 10
  const sectionId = '4a5b221c-572e-4b6c-a817-7fbbd6da7407'; // Section A
  const academicYearId = 'cb790f78-25dd-4c93-8761-3d563ae86402';
  const academicTermId = '9d7b4d3e-d38a-421e-a44b-6c7799aa8a09';
  const biologySubjId = '9e4e57f3-30e8-4d32-8d40-efada99c0007';
  const physicsSubjId = '9bdc9fd4-1056-4b6f-a087-5390d91d8ab1';
  const chemistrySubjId = '8335897b-c82d-4d1a-874d-f8f9fdfac733';
  const adminUserId = '3ed105d9-4959-402c-915c-cf69c596dd89';

  const bioSub = await prisma.assessmentSubmissionRecord.findFirst({
    where: { gradeId, sectionId, subjectId: biologySubjId, academicYearId, academicTermId },
  });
  const phySub = await prisma.assessmentSubmissionRecord.findFirst({
    where: { gradeId, sectionId, subjectId: physicsSubjId, academicYearId, academicTermId },
  });

  if (!bioSub || !phySub) {
    throw new Error('Biology or Physics submission record missing for Grade 10 Section A test setup');
  }

  // Helper to reset test state
  const resetSubmissions = async (bioStatus: string, phyStatus: string) => {
    await prisma.assessmentSubmissionRecord.update({
      where: { id: bioSub.id },
      data: { status: bioStatus, publishedAt: null, rejectionReason: null },
    });
    await prisma.assessmentSubmissionRecord.update({
      where: { id: phySub.id },
      data: { status: phyStatus, publishedAt: null, rejectionReason: null },
    });
    await prisma.assessment.updateMany({
      where: { gradeId, subjectId: biologySubjId },
      data: { status: bioStatus === 'APPROVED' ? 'APPROVED' : 'SUBMITTED' },
    });
    await prisma.assessment.updateMany({
      where: { gradeId, subjectId: physicsSubjId },
      data: { status: phyStatus === 'APPROVED' ? 'APPROVED' : 'SUBMITTED' },
    });
    await prisma.reportCard.updateMany({
      where: { gradeId, sectionId, academicYearId, academicTermId },
      data: { status: 'DRAFT', publishedAt: null, publishedById: null, republishedAt: null, republishedById: null },
    });
  };

  try {
    // ---------------------------------------------------------------------------------
    // TEST 1: One subject is approved while other subjects are pending: report card remains unpublished
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 1: Biology APPROVED, Physics PENDING_APPROVAL');
    await resetSubmissions('APPROVED', 'SUBMITTED');

    // Generate/sync draft report cards
    await gradebookService.generateReportCards({ gradeId, sectionId, academicYearId, academicTermId });

    const cardsT1 = await prisma.reportCard.findMany({
      where: { gradeId, sectionId, academicYearId, academicTermId },
    });

    const anyPublishedT1 = cardsT1.some((c) => c.status === 'PUBLISHED');
    const allDraftT1 = cardsT1.every((c) => c.status === 'DRAFT');

    console.log(`   - Total Cards: ${cardsT1.length}`);
    console.log(`   - Any Published? ${anyPublishedT1} (Expected: false)`);
    console.log(`   - All DRAFT? ${allDraftT1} (Expected: true)`);
    if (anyPublishedT1 || !allDraftT1) throw new Error('TEST 1 FAILED: Report card was published or not in DRAFT');

    // Attempting to publish should be blocked
    const firstCard = cardsT1[0];
    let publishBlocked = false;
    try {
      await gradebookService.publishReportCard(firstCard.id, adminUserId);
    } catch (err: any) {
      publishBlocked = true;
      console.log(`   - Publication correctly blocked with reason: "${err.message}"`);
    }
    if (!publishBlocked) throw new Error('TEST 1 FAILED: Publish was not blocked when Physics was pending');
    console.log('✅ TEST 1 PASSED: Report card remains unpublished when one subject is pending.\n');

    // ---------------------------------------------------------------------------------
    // TEST 2: Some subjects approved and another subject has not been submitted: publication blocked
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 2: Biology APPROVED, Physics APPROVED, but Chemistry assigned with NO submission');
    await resetSubmissions('APPROVED', 'APPROVED');

    // Temporarily create teacher assignment for Chemistry without any submission record
    const tempAssignment = await prisma.teacherAssignment.create({
      data: {
        teacher_id: bioSub.teacherId,
        gradeId,
        sectionId,
        subjectId: chemistrySubjId,
        role: 'SUBJECT_TEACHER',
      },
    });

    await gradebookService.generateReportCards({ gradeId, sectionId, academicYearId, academicTermId });

    const valT2 = await gradebookService.validateReportCardReadiness(firstCard.id);
    console.log(`   - Is Ready? ${valT2.isReady} (Expected: false)`);
    console.log(`   - Blockers:`, valT2.blockers);

    // Clean up temporary assignment
    await prisma.teacherAssignment.delete({ where: { id: tempAssignment.id } });

    if (valT2.isReady || !valT2.blockers.some((b) => b.includes('Chemistry'))) {
      throw new Error('TEST 2 FAILED: Publication was not blocked when Chemistry was unsubmitted');
    }
    console.log('✅ TEST 2 PASSED: Publication blocked when an assigned subject has no submission.\n');

    // ---------------------------------------------------------------------------------
    // TEST 3: All subjects submitted but one awaiting approval: publication blocked
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 3: All subjects submitted, Biology SUBMITTED, Physics APPROVED');
    await resetSubmissions('SUBMITTED', 'APPROVED');
    await gradebookService.generateReportCards({ gradeId, sectionId, academicYearId, academicTermId });

    const valT3 = await gradebookService.validateReportCardReadiness(firstCard.id);
    console.log(`   - Is Ready? ${valT3.isReady} (Expected: false)`);
    console.log(`   - Blockers:`, valT3.blockers);
    if (valT3.isReady || !valT3.blockers.some((b) => b.includes('Biology'))) {
      throw new Error('TEST 3 FAILED: Publication was not blocked when Biology was awaiting approval');
    }
    console.log('✅ TEST 3 PASSED: Publication blocked when a submitted subject is awaiting approval.\n');

    // ---------------------------------------------------------------------------------
    // TEST 4: All required subjects approved: becomes Ready for Review, NOT auto-published
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 4: Biology APPROVED, Physics APPROVED');
    await resetSubmissions('APPROVED', 'APPROVED');
    await gradebookService.generateReportCards({ gradeId, sectionId, academicYearId, academicTermId });

    const cardsT4 = await prisma.reportCard.findMany({
      where: { gradeId, sectionId, academicYearId, academicTermId },
    });

    const allReadyT4 = cardsT4.every((c) => c.status === 'READY');
    const nonePublishedT4 = cardsT4.every((c) => c.publishedAt === null);

    console.log(`   - All READY? ${allReadyT4} (Expected: true)`);
    console.log(`   - None Published? ${nonePublishedT4} (Expected: true)`);
    if (!allReadyT4 || !nonePublishedT4) {
      throw new Error('TEST 4 FAILED: Report cards did not transition to READY without auto-publishing');
    }
    console.log('✅ TEST 4 PASSED: Complete approved report cards become Ready for Review, NOT auto-published.\n');

    // ---------------------------------------------------------------------------------
    // TEST 5: Authorized administrator publishes complete report card: visible to student
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 5: Administrator publishes single report card');
    const publishedCard = await gradebookService.publishReportCard(firstCard.id, adminUserId);
    console.log(`   - Status: ${publishedCard.status} (Expected: PUBLISHED)`);
    console.log(`   - PublishedAt: ${publishedCard.publishedAt?.toISOString()}`);
    console.log(`   - PublishedById: ${publishedCard.publishedById} (Expected: ${adminUserId})`);

    // Verify student query returns it
    const studentCards = await gradebookService.getStudentReportCard(firstCard.studentId, academicTermId, academicYearId);
    console.log(`   - Student Query Return Count: ${studentCards.length} (Expected: 1)`);
    if (publishedCard.status !== 'PUBLISHED' || studentCards.length === 0) {
      throw new Error('TEST 5 FAILED: Report card was not published or not visible to student');
    }
    console.log('✅ TEST 5 PASSED: Administrator published report card and it is visible to student.\n');

    // ---------------------------------------------------------------------------------
    // TEST 6: Unauthorized access protection
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 6: Student/Parent cannot view unpublished report card');
    const unpublishedStudentId = cardsT4[1].studentId;
    const isUnpublishedVisible = await gradebookService.isReportCardPublished(unpublishedStudentId, academicYearId, academicTermId);
    console.log(`   - Is unpublished card visible to student/parent? ${isUnpublishedVisible} (Expected: false)`);
    if (isUnpublishedVisible) {
      throw new Error('TEST 6 FAILED: Unpublished card was reported as visible');
    }
    console.log('✅ TEST 6 PASSED: Unpublished report cards are protected from students and parents.\n');

    // ---------------------------------------------------------------------------------
    // TEST 7: Marks change after publication: correction rules enforced
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 7: Marks reopened/returned after publication -> transition to NEEDS_CORRECTION');
    // Admin returns Physics submission for correction
    await assessmentSubmissionService.returnSubmission(phySub.id, 'Please correct question 4 mark calculation', adminUserId);

    const cardAfterReturn = await prisma.reportCard.findUnique({
      where: { id: firstCard.id },
    });
    console.log(`   - Report Card Status after mark return: ${cardAfterReturn?.status} (Expected: NEEDS_CORRECTION)`);
    if (cardAfterReturn?.status !== 'NEEDS_CORRECTION') {
      throw new Error('TEST 7 FAILED: Status did not transition to NEEDS_CORRECTION after return');
    }

    // Teacher re-submits and Admin re-approves
    await assessmentSubmissionService.teacherSubmitMarks({
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId: physicsSubjId,
      teacherId: phySub.teacherId,
      notes: 'Corrected question 4',
    });
    await assessmentSubmissionService.approveSubmission(phySub.id, adminUserId);

    // Now re-publish
    const republished = await gradebookService.publishReportCard(firstCard.id, adminUserId);
    console.log(`   - Republished Status: ${republished.status} (Expected: PUBLISHED)`);
    console.log(`   - RepublishedAt: ${republished.republishedAt?.toISOString()}`);
    console.log(`   - RepublishedById: ${republished.republishedById}`);
    if (republished.status !== 'PUBLISHED' || !republished.republishedAt) {
      throw new Error('TEST 7 FAILED: Republication was not recorded');
    }
    console.log('✅ TEST 7 PASSED: Correction and republication rules verified.\n');

    // ---------------------------------------------------------------------------------
    // TEST 8: Bulk publication skips incomplete report cards and reports summary
    // ---------------------------------------------------------------------------------
    console.log('👉 TEST 8: Bulk publication across entire section');
    const bulkResult = await gradebookService.bulkPublishReportCards(
      { gradeId, sectionId, academicYearId, academicTermId },
      adminUserId
    );
    console.log(`   - Total Cards Evaluated: ${bulkResult.total}`);
    console.log(`   - Successfully Published: ${bulkResult.publishedCount}`);
    console.log(`   - Skipped/Blocked Count: ${bulkResult.skippedCount}`);
    if (bulkResult.publishedCount === 0) {
      throw new Error('TEST 8 FAILED: Bulk publication did not publish eligible cards');
    }
    console.log('✅ TEST 8 PASSED: Bulk publication executed and reported summary.\n');

    console.log('🎉 ALL 8 ACCEPTANCE CRITERIA TESTS PASSED PERFECTLY!');
  } finally {
    // Restore clean state
    await resetSubmissions('APPROVED', 'APPROVED');
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
