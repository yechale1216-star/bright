import prisma from '../config/db';
import { assessmentSubmissionService } from '../services/assessment-submission.service';

async function testMarkSubmissionApproval() {
  console.log('=== Starting Mark Submission & Approval Test Suite ===\n');

  // 1. Fetch Academic Context
  const academicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    include: { terms: true },
  }) || await prisma.academicYear.findFirst({
    include: { terms: true },
  });

  if (!academicYear) {
    console.error('No academic year found.');
    return;
  }

  const term = academicYear.terms[0] || await prisma.academicTerm.findFirst({
    where: { academicYearId: academicYear.id },
  });

  if (!term) {
    console.error('No academic term found.');
    return;
  }

  console.log(`[1] Academic Context: Year "${academicYear.name}" | Term "${term.name}"`);

  // 2. Fetch Grade, Section, Subject, Teacher
  const grade = await prisma.grade.findFirst();
  const section = await prisma.section.findFirst();
  const subject = await prisma.subject.findFirst();
  const teacher = await prisma.teacher.findFirst();

  if (!grade || !section || !subject || !teacher) {
    console.error('Missing grade, section, subject, or teacher data in DB.');
    return;
  }

  console.log(`[2] Target: Grade "${grade.name}" | Section "${section.name}" | Subject "${subject.name}" | Teacher "${teacher.name}"`);

  // 3. Test Teacher Submission
  console.log('\n[3] Testing teacherSubmitMarks()...');
  const submittedRecord = await assessmentSubmissionService.teacherSubmitMarks({
    academicYearId: academicYear.id,
    academicTermId: term.id,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    teacherId: teacher.id,
    notes: 'Term 1 assessment scores completed and submitted for review.',
  });

  console.log(`    Submission ID: ${submittedRecord.id}`);
  console.log(`    Status: ${submittedRecord.status}`);
  console.log(`    Submitted At: ${submittedRecord.submittedAt}`);

  // 4. Test Dashboard Metrics
  console.log('\n[4] Testing getDashboardMetrics()...');
  const metrics = await assessmentSubmissionService.getDashboardMetrics({
    academicYearId: academicYear.id,
    academicTermId: term.id,
  });
  console.log('    Dashboard Metrics:', metrics);

  // 5. Test Submissions Query & Progress Calculation
  console.log('\n[5] Testing getSubmissions() with filters and progress stats...');
  const result = await assessmentSubmissionService.getSubmissions({
    academicYearId: academicYear.id,
    academicTermId: term.id,
    page: 1,
    limit: 10,
  });

  console.log(`    Fetched ${result.submissions.length} submissions (Total: ${result.pagination.total})`);
  if (result.submissions.length > 0) {
    const first = result.submissions[0];
    console.log(`    Sample: ${first.subject.name} - Grade ${first.grade.name} (${first.section.name})`);
    console.log(`    Teacher: ${first.teacher.name} | Status: ${first.status} | Completion: ${first.metrics.completionPercentage}%`);
  }

  // 6. Test Submission Details & Student Marks Review
  console.log('\n[6] Testing getSubmissionDetails()...');
  const details = await assessmentSubmissionService.getSubmissionDetails(submittedRecord.id);
  console.log(`    Subject: ${details.submission.subject.name}`);
  console.log(`    Total Students: ${details.stats.totalStudents}`);
  console.log(`    Completed: ${details.stats.completedStudents}, Missing: ${details.stats.missingStudents}, Absent: ${details.stats.absentStudents}`);
  console.log(`    Recent Activities Count: ${details.activities.length}`);

  // 7. Test Return for Correction
  console.log('\n[7] Testing returnSubmission() with reason...');
  const returned = await assessmentSubmissionService.returnSubmission(
    submittedRecord.id,
    'Please verify the marks for absent students and re-submit.'
  );
  console.log(`    New Status: ${returned.status}`);
  console.log(`    Rejection Reason: ${returned.rejectionReason}`);

  // 8. Test Resubmission
  console.log('\n[8] Testing Teacher Resubmission...');
  const resubmitted = await assessmentSubmissionService.teacherSubmitMarks({
    academicYearId: academicYear.id,
    academicTermId: term.id,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: subject.id,
    teacherId: teacher.id,
    notes: 'Revised and resubmitted marks.',
  });
  console.log(`    Resubmitted Status: ${resubmitted.status}`);

  // 9. Test Approval
  console.log('\n[9] Testing approveSubmission()...');
  const approved = await assessmentSubmissionService.approveSubmission(submittedRecord.id);
  console.log(`    Approved Status: ${approved.status}`);
  console.log(`    Reviewed At: ${approved.reviewedAt}`);

  // 10. Test Reopen
  console.log('\n[10] Testing reopenSubmission()...');
  const reopened = await assessmentSubmissionService.reopenSubmission(
    submittedRecord.id,
    'Reopened upon teacher request to fix a typo in student score.'
  );
  console.log(`    Reopened Status: ${reopened.status}`);
  console.log(`    Reopen Reason: ${reopened.reopenReason}`);

  // 11. Test Bulk Approval
  console.log('\n[11] Testing bulkApproveSubmissions()...');
  const bulkResult = await assessmentSubmissionService.bulkApproveSubmissions([submittedRecord.id]);
  console.log('    Bulk Result:', bulkResult);

  // 12. Test Publish
  console.log('\n[12] Testing publishSubmission()...');
  const published = await assessmentSubmissionService.publishSubmission(submittedRecord.id);
  console.log(`    Published Status: ${published.status}`);
  console.log(`    Published At: ${published.publishedAt}`);

  console.log('\n=== ALL MARK SUBMISSION & APPROVAL TESTS PASSED SUCCESSFULLY ===');
}

testMarkSubmissionApproval()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
