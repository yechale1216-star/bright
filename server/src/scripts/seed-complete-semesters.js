/**
 * Complete Seed Script for Grade 10 Section A (2018 E.C.)
 * 
 * Implements full workflow:
 * 1. Ensure all assessments in Sem 1 & Sem 2 are APPROVED
 * 2. Seed realistic assessment marks for all active students (preserving existing marks)
 * 3. Clean up the 6 invalid/test scheme assignments (dhg, PVA, ECN, duplicate MTH/PED/ICT)
 *    so both Semester 1 and Semester 2 have the exact same 10 required subjects
 * 4. Upsert APPROVED submission records for missing subjects (CIT, PE10) in both semesters
 * 5. Run generateReportCards and bulkPublishReportCards for Semester 1 and Semester 2
 * 6. Verify readiness of all 4 terms and annual unlock status
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// IDs
const AY_ID      = 'cb790f78-25dd-4c93-8761-3d563ae86402'; // 2018 E.C.
const MID1_ID    = '03d13836-c360-4916-b946-846490b283a2'; // Mid 1
const SEM1_ID    = '9d7b4d3e-d38a-421e-a44b-6c7799aa8a09'; // Semester 1
const MID2_ID    = '2080156c-cc8a-4c9e-8650-fc773494e924'; // Mid 2
const SEM2_ID    = 'da8cffcd-447f-4f46-8059-ab4fb4581d15'; // Semester 2
const GRADE10_ID = '94d5b1d0-bb43-4a46-b60c-2ef203de8310'; // Grade 10
const SECA_ID    = 'f8bb9e8f-b263-4e2a-a856-5e3bb2d9b244'; // Section A

// Invalid test / duplicate subjects in Grade 10 scheme assignments
const BOGUS_SCHEME_SUBJECT_IDS = [
  '55a763b6-25c6-4541-aa2f-c1feeda0d895', // dhg (NHGJ)
  '4d1cbf60-eaff-482c-8f24-f573faecda4b', // Economics (ECN)
  'ebb569bc-d95b-4d3d-95b1-5bab1d338c09', // PVA (PVA)
  'a1994c85-7bec-42c1-adb8-7cc9e4a56ac6', // Maths (MTH) duplicate
  '2a7b0618-87f7-472d-ad76-8b71162d3517', // Phy. Edu. (PED) duplicate
  '5cf6d570-bbaa-4f84-b002-0e71cc21d21e', // Inform. Tech. (ICT) duplicate
];

// Realistic student performance profiles (% target base)
const STUDENT_PROFILES = {
  'ST-2019-10-001': { base: 82, variance: 6 }, // Abebe Bikila
  'ST-2019-10-002': { base: 91, variance: 5 }, // Almaz Ayana
  'ST-2019-10-003': { base: 80, variance: 7 }, // Kenenisa Bekele
  'ST-2019-10-004': { base: 88, variance: 5 }, // Derartu Tulu
  'ST-2019-10-005': { base: 93, variance: 4 }, // Haile Gebrselassie
  'ST-2019-10-006': { base: 84, variance: 6 }, // Tirunesh Dibaba
  'ST-2019-10-007': { base: 76, variance: 8 }, // Yifter Miruts
  'ST-2019-10-008': { base: 89, variance: 5 }, // Meseret Defar
  'STU000014':      { base: 85, variance: 6 }, // Amanuel Desalegn
  'STU000016':      { base: 90, variance: 5 }, // Sara Tadesse
  'STU000024':      { base: 74, variance: 7 }, // Bereket Desalegn
};

// Deterministic pseudo-random based on string seed
function pseudoRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

function calculateScore(studentId, assessmentId, maxScore) {
  const profile = STUDENT_PROFILES[studentId] || { base: 80, variance: 6 };
  const rand = pseudoRandom(`${studentId}-${assessmentId}`);
  // score pct between base - variance and base + variance
  const pct = (profile.base - profile.variance) + (rand * profile.variance * 2);
  const rawScore = (pct / 100) * maxScore;
  return Math.round(rawScore * 10) / 10;
}

async function main() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  SEEDING REPORT CARD DATA: GRADE 10 SECTION A (2018 E.C.)');
  console.log('════════════════════════════════════════════════════════════════════\n');

  // 1. Fetch active students in Grade 10 Section A
  const students = await prisma.student.findMany({
    where: {
      gradeId: GRADE10_ID,
      sectionId: SECA_ID,
      status: 'ACTIVE',
    },
    select: { id: true, student_id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
  console.log(`[1] Found ${students.length} ACTIVE students in Grade 10 Sec A.`);

  // 2. Fetch a teacher and reviewer
  const teacher = await prisma.teacher.findFirst({ select: { id: true, name: true } });
  if (!teacher) throw new Error('No teacher found in database');
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true },
  }).catch(() => null);
  const reviewerId = admin?.id ?? teacher.id;
  console.log(`[2] Using Teacher: ${teacher.name} (${teacher.id}), Reviewer: ${reviewerId}`);

  // 3. Clean up the 6 invalid/test scheme assignments
  console.log('\n[3] Cleaning up bogus scheme assignments in Grade 10 Sem 1...');
  const deletedSchemes = await prisma.assessmentSchemeAssignment.deleteMany({
    where: {
      gradeId: GRADE10_ID,
      subjectId: { in: BOGUS_SCHEME_SUBJECT_IDS },
    },
  });
  console.log(`    Deleted ${deletedSchemes.count} invalid scheme assignments.`);

  // 4. Ensure all assessments for Sem 1 and Sem 2 are APPROVED
  console.log('\n[4] Ensuring all Sem 1 & Sem 2 assessments are APPROVED...');
  const updatedAssessments = await prisma.assessment.updateMany({
    where: {
      gradeId: GRADE10_ID,
      academicYearId: AY_ID,
      academicTermId: { in: [SEM1_ID, SEM2_ID] },
      status: { not: 'APPROVED' },
    },
    data: { status: 'APPROVED' },
  });
  console.log(`    Updated ${updatedAssessments.count} assessments to APPROVED.`);

  // 5. Seed missing assessment marks for active students
  console.log('\n[5] Seeding assessment marks for Sem 1 and Sem 2...');
  const termAssessments = await prisma.assessment.findMany({
    where: {
      gradeId: GRADE10_ID,
      academicYearId: AY_ID,
      academicTermId: { in: [SEM1_ID, SEM2_ID] },
    },
    include: {
      subject: true,
      academicTerm: true,
      marks: true,
    },
  });

  let marksCreated = 0;
  let marksSkipped = 0;

  for (const assess of termAssessments) {
    const existingMarkStudentIds = new Set(assess.marks.map((m) => m.studentId));

    for (const student of students) {
      if (existingMarkStudentIds.has(student.id)) {
        marksSkipped++;
        continue;
      }

      const score = calculateScore(student.student_id, assess.id, assess.maxScore);

      await prisma.studentMark.create({
        data: {
          assessmentId: assess.id,
          studentId:    student.id,
          score:        score,
          status:       'PRESENT',
          isAbsent:     false,
          gradedById:   teacher.id,
        },
      });
      marksCreated++;
    }
  }
  console.log(`    Marks created: ${marksCreated}, already existing: ${marksSkipped}.`);

  // 6. Ensure all 10 required subjects have APPROVED AssessmentSubmissionRecord in both Sem 1 and Sem 2
  console.log('\n[6] Ensuring teacher submission & approval records for required subjects...');
  const now = new Date();

  // Load gradebook service
  const { gradebookService } = require('../../dist/services/gradebook.service');

  for (const [termName, termId] of [['Semester 1', SEM1_ID], ['Semester 2', SEM2_ID]]) {
    const requiredSubs = await gradebookService.getRequiredSubjectsForGradeAndSection(
      GRADE10_ID,
      SECA_ID,
      AY_ID,
      termId
    );
    console.log(`\n    --- ${termName}: ${requiredSubs.length} required subjects ---`);

    for (const sub of requiredSubs) {
      const existing = await prisma.assessmentSubmissionRecord.findFirst({
        where: {
          academicYearId: AY_ID,
          academicTermId: termId,
          gradeId:        GRADE10_ID,
          sectionId:      SECA_ID,
          subjectId:      sub.id,
        },
      });

      if (!existing) {
        await prisma.assessmentSubmissionRecord.create({
          data: {
            academicYearId: AY_ID,
            academicTermId: termId,
            gradeId:        GRADE10_ID,
            sectionId:      SECA_ID,
            subjectId:      sub.id,
            teacherId:      teacher.id,
            status:         'APPROVED',
            submittedAt:    now,
            reviewedById:   reviewerId,
            reviewedAt:     now,
          },
        });
        console.log(`    + Created APPROVED submission for [${sub.code}] ${sub.name}`);
      } else if (existing.status !== 'APPROVED') {
        await prisma.assessmentSubmissionRecord.update({
          where: { id: existing.id },
          data: {
            status:       'APPROVED',
            reviewedById: reviewerId,
            reviewedAt:   now,
          },
        });
        console.log(`    ↑ Approved existing submission for [${sub.code}] ${sub.name}`);
      } else {
        console.log(`    ✓ Already APPROVED: [${sub.code}] ${sub.name}`);
      }
    }
  }

  // 7. Generate and Publish report cards for Semester 1 and Semester 2
  console.log('\n[7] Generating and publishing report cards...');
  const baseParams = {
    gradeId:        GRADE10_ID,
    sectionId:      SECA_ID,
    academicYearId: AY_ID,
  };

  for (const [termName, termId] of [['Semester 1', SEM1_ID], ['Semester 2', SEM2_ID]]) {
    console.log(`\n    >>> Generating Report Cards for ${termName}...`);
    const genResult = await gradebookService.generateReportCards({
      ...baseParams,
      academicTermId: termId,
    });
    console.log(`    Generated: ${genResult.count || genResult.reportCards?.length || 'OK'}`);

    console.log(`    >>> Bulk Publishing Report Cards for ${termName}...`);
    const pubResult = await gradebookService.bulkPublishReportCards({
      ...baseParams,
      academicTermId: termId,
    });
    console.log(`    Published: ${pubResult.count || 'OK'}`);
  }

  // 8. Final Verification of Readiness Overview for All 4 Terms
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  FINAL VERIFICATION: ALL 4 TERMS READINESS');
  console.log('════════════════════════════════════════════════════════════════════');

  const terms = [
    { label: 'Mid 1',      id: MID1_ID },
    { label: 'Semester 1', id: SEM1_ID },
    { label: 'Mid 2',      id: MID2_ID },
    { label: 'Semester 2', id: SEM2_ID },
  ];

  let allTermsReady = true;
  for (const t of terms) {
    const ov = await gradebookService.getClassReadinessOverview({
      ...baseParams,
      academicTermId: t.id,
    });
    const ready = ov?.isFullyReady ?? ov?.classReadiness?.isFullyReady;
    const approved = ov?.approvedSubjectsCount ?? ov?.approvedSubjects ?? '?';
    const total = ov?.totalRequiredSubjects ?? ov?.requiredSubjects ?? '?';
    console.log(`  ${t.label.padEnd(14)}: isFullyReady = ${ready ? '✅ TRUE ' : '❌ FALSE'} (${approved}/${total} approved)`);
    if (!ready) allTermsReady = false;
  }

  console.log('\n────────────────────────────────────────────────────────────────────');
  if (allTermsReady) {
    console.log('  🎉 SUCCESS: ALL 4 TERMS ARE FULLY READY & APPROVED!');
    console.log('  🏆 ANNUAL REPORT CARD TAB IS NOW UNLOCKED AND ACTIVE!');
  } else {
    console.log('  ⚠️ WARNING: Some terms are still not fully ready.');
  }
  console.log('────────────────────────────────────────────────────────────────────\n');

  // 9. Inspect a sample generated report card from Sem 1 and Sem 2
  for (const [termName, termId] of [['Semester 1', SEM1_ID], ['Semester 2', SEM2_ID]]) {
    const sample = await prisma.reportCard.findFirst({
      where: {
        academicYearId: AY_ID,
        academicTermId: termId,
        gradeId:        GRADE10_ID,
        sectionId:      SECA_ID,
        student:        { status: 'ACTIVE' },
      },
      include: {
        student:       { select: { fullName: true, student_id: true } },
        subjectScores: { include: { subject: true } },
      },
    });
    if (sample) {
      console.log(`[Sample Report Card] ${termName}:`);
      console.log(`  Student : ${sample.student.fullName} (${sample.student.student_id})`);
      console.log(`  Status  : ${sample.status}`);
      console.log(`  Total   : ${sample.totalScore} / ${sample.maxPossibleScore}`);
      console.log(`  Average : ${sample.averageScore}% | GPA: ${sample.gpa} | Rank: ${sample.rank}/${sample.totalStudentsInClass}`);
      console.log(`  Subjects (${sample.subjectScores.length}): ${sample.subjectScores.map(s => `${s.subject.code}: ${s.score}`).join(', ')}`);
      console.log('');
    }
  }
}

main()
  .catch((err) => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
