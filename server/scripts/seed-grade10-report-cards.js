require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl }
  }
});

const GRADE_10_ID = '94d5b1d0-bb43-4a46-b60c-2ef203de8310'; // Grade 10
const SECTION_A_ID = 'f8bb9e8f-b263-4e2a-a856-5e3bb2d9b244'; // Section A
const ACADEMIC_YEAR_ID = 'cb790f78-25dd-4c93-8761-3d563ae86402'; // 2018 E.C.

// Terms in 2018 E.C.
const TERMS = {
  MID_1: { id: '03d13836-c360-4916-b946-846490b283a2', name: 'Mid 1', isMid: true, semGroup: 1 },
  SEM_1: { id: '9d7b4d3e-d38a-421e-a44b-6c7799aa8a09', name: 'Semester 1', isMid: false, semGroup: 1 },
  MID_2: { id: '2080156c-cc8a-4c9e-8650-fc773494e924', name: 'Mid 2', isMid: true, semGroup: 2 },
  SEM_2: { id: 'da8cffcd-447f-4f46-8059-ab4fb4581d15', name: 'Semester 2', isMid: false, semGroup: 2 },
};

// 8 Subjects requested by user
const SUBJECTS = [
  { id: '9e4e57f3-30e8-4d32-8d40-efada99c0007', name: 'Biology', code: 'BIO' },
  { id: '8335897b-c82d-4d1a-874d-f8f9fdfac733', name: 'Chemistry', code: 'CHM' },
  { id: '9bdc9fd4-1056-4b6f-a087-5390d91d8ab1', name: 'Physics', code: 'PHY' },
  { id: '226782fc-f767-4c92-8972-394c33911f43', name: 'Information Technology', code: 'IT10' },
  { id: 'd6d5c8d9-7037-40e3-8f20-b3c43e258053', name: 'History', code: 'HIS' },
  { id: '3a18d6fd-131f-4c44-b1f5-ce67a6179509', name: 'Geography', code: 'GEO' },
  { id: 'b4e7fc0b-0eb1-4195-9918-f81d894cfd25', name: 'Mathematics', code: 'MATH10' },
  { id: '409c7ec9-5780-437a-999d-358f2f1a5d14', name: 'English', code: 'ENG' },
];

function getGradeLetterAndGpa(score) {
  if (score >= 90) return { letter: 'A+', gpa: 4.0, isPassing: true };
  if (score >= 85) return { letter: 'A', gpa: 4.0, isPassing: true };
  if (score >= 80) return { letter: 'B+', gpa: 3.5, isPassing: true };
  if (score >= 75) return { letter: 'B', gpa: 3.0, isPassing: true };
  if (score >= 65) return { letter: 'C+', gpa: 2.5, isPassing: true };
  if (score >= 60) return { letter: 'C', gpa: 2.0, isPassing: true };
  if (score >= 50) return { letter: 'D', gpa: 1.0, isPassing: true };
  return { letter: 'F', gpa: 0.0, isPassing: false };
}

// Student Profiles with different outcome statuses (Passed, Passed Conditional, Failed) and report card statuses (PUBLISHED, READY, DRAFT, NEEDS_CORRECTION)
const STUDENT_PROFILES = [
  {
    id: 'c45a2e87-1128-4c6e-992a-831f04d2644b',
    name: 'Mekilit Desalegn',
    rank: 1,
    outcome: 'Passed / Promoted',
    conduct: 'A+',
    attendance: { present: 47, total: 48 },
    teacherComment: 'Outstanding academic performance throughout the year. Keep up the high standard!',
    principalComment: 'Promoted with High Distinction. Exemplary work!',
    statuses: {
      MID_1: 'PUBLISHED',
      SEM_1: 'PUBLISHED',
      MID_2: 'PUBLISHED',
      SEM_2: 'PUBLISHED',
    },
    // Scores by subject: [mid1, sem1, mid2, sem2]
    scores: {
      Biology: [92, 94, 95, 96],
      Chemistry: [90, 92, 94, 95],
      Physics: [88, 90, 91, 93],
      'Information Technology': [95, 96, 98, 97],
      History: [89, 91, 92, 94],
      Geography: [90, 93, 94, 95],
      Mathematics: [93, 95, 96, 97],
      English: [91, 93, 94, 96],
    },
  },
  {
    id: '1c372d7d-f2e6-49a1-b4b7-fe2de2ac984c',
    name: 'Sara Tadesse',
    rank: 2,
    outcome: 'Passed / Promoted',
    conduct: 'A',
    attendance: { present: 45, total: 48 },
    teacherComment: 'Very good effort, strong work ethic, and active classroom participation.',
    principalComment: 'Promoted with Commendation. Great achievement.',
    statuses: {
      MID_1: 'PUBLISHED',
      SEM_1: 'PUBLISHED',
      MID_2: 'PUBLISHED',
      SEM_2: 'PUBLISHED',
    },
    scores: {
      Biology: [82, 85, 86, 88],
      Chemistry: [80, 83, 85, 87],
      Physics: [78, 81, 82, 84],
      'Information Technology': [86, 88, 90, 91],
      History: [81, 84, 85, 86],
      Geography: [83, 85, 87, 88],
      Mathematics: [84, 86, 87, 89],
      English: [85, 87, 88, 90],
    },
  },
  {
    id: 'f2a874b8-8bf2-4218-b687-f443b96d0dd5',
    name: 'Amanuel Desalegn',
    rank: 3,
    outcome: 'Passed / Promoted',
    conduct: 'B+',
    attendance: { present: 43, total: 48 },
    teacherComment: 'Consistent performance. Demonstrates solid understanding across curriculum.',
    principalComment: 'Promoted to Grade 11.',
    statuses: {
      MID_1: 'READY',
      SEM_1: 'PUBLISHED',
      MID_2: 'READY',
      SEM_2: 'READY',
    },
    scores: {
      Biology: [68, 70, 72, 74],
      Chemistry: [65, 67, 69, 71],
      Physics: [62, 64, 66, 68],
      'Information Technology': [74, 76, 78, 80],
      History: [70, 72, 73, 75],
      Geography: [67, 69, 71, 73],
      Mathematics: [64, 66, 68, 70],
      English: [72, 74, 75, 77],
    },
  },
  {
    id: '0922ca67-0cba-416e-a048-9b8042a43a42',
    name: 'Bereket Desalegn',
    rank: 4,
    outcome: 'Passed (Conditional) / Promoted (Conditional)',
    conduct: 'B',
    attendance: { present: 41, total: 48 },
    teacherComment: 'Promoted on probation. Supplemental tutorials recommended in Physics.',
    principalComment: 'Conditional promotion granted subject to re-examination / remediation in Physics.',
    statuses: {
      MID_1: 'DRAFT',
      SEM_1: 'READY',
      MID_2: 'DRAFT',
      SEM_2: 'DRAFT',
    },
    // Fails 1 subject: Physics (42-45)
    scores: {
      Biology: [58, 60, 62, 64],
      Chemistry: [54, 56, 58, 60],
      Physics: [42, 44, 43, 45], // Failed (< 50)
      'Information Technology': [65, 68, 70, 72],
      History: [60, 62, 63, 65],
      Geography: [57, 59, 61, 63],
      Mathematics: [53, 55, 56, 58],
      English: [62, 64, 65, 67],
    },
  },
  {
    id: 'fefc1e0d-ddc1-42fc-a79d-3e28bf3f4771',
    name: 'Abel Henok',
    rank: 5,
    outcome: 'Failed / Retained',
    conduct: 'C+',
    attendance: { present: 36, total: 48 },
    teacherComment: 'Struggled significantly in STEM subjects. Requires remedial foundation.',
    principalComment: 'Retained. Does not satisfy promotional criteria for Grade 11.',
    statuses: {
      MID_1: 'NEEDS_CORRECTION',
      SEM_1: 'NEEDS_CORRECTION',
      MID_2: 'NEEDS_CORRECTION',
      SEM_2: 'NEEDS_CORRECTION',
    },
    // Fails 3 subjects: Maths (41-43), Physics (36-40), Chemistry (43-46)
    scores: {
      Biology: [50, 52, 51, 53],
      Chemistry: [43, 45, 44, 46], // Failed
      Physics: [36, 38, 37, 40], // Failed
      'Information Technology': [52, 54, 55, 56],
      History: [51, 53, 52, 54],
      Geography: [49, 51, 50, 52],
      Mathematics: [40, 42, 41, 43], // Failed
      English: [53, 55, 54, 56],
    },
  },
  {
    id: '69bc3205-542b-4860-a73a-e4bae530c34c',
    name: 'Henok Kidus',
    rank: 6,
    outcome: 'Failed / Retained',
    conduct: 'C',
    attendance: { present: 29, total: 48 },
    teacherComment: 'Excessive absences and missed assignments severely impacted results.',
    principalComment: 'Retained in Grade 10.',
    statuses: {
      MID_1: 'DRAFT',
      SEM_1: 'DRAFT',
      MID_2: 'DRAFT',
      SEM_2: 'DRAFT',
    },
    // Fails 5 subjects: Maths, Physics, Chemistry, IT, Biology
    scores: {
      Biology: [42, 44, 43, 45], // Failed
      Chemistry: [34, 37, 36, 39], // Failed
      Physics: [32, 34, 33, 36], // Failed
      'Information Technology': [40, 42, 41, 44], // Failed
      History: [46, 48, 47, 49], // Failed
      Geography: [48, 50, 49, 51],
      Mathematics: [28, 31, 30, 33], // Failed
      English: [50, 52, 51, 53],
    },
  },
];

async function main() {
  console.log('=== STARTING SEED FOR GRADE 10 SECTION A REPORT CARDS ===');

  // 1. Get or verify Teacher Dr. Ermias
  const teacher = await prisma.teacher.findFirst({
    where: { name: { contains: 'Ermias', mode: 'insensitive' } },
  });
  const teacherId = teacher?.id || (await prisma.teacher.findFirst()).id;
  console.log(`Using teacher: ${teacher?.name || 'Default'} (${teacherId})`);

  // 2. Ensure all 8 subjects are linked to Grade 10 in GradeSubject
  console.log('--- Linking 8 Subjects to Grade 10 (GradeSubject) ---');
  for (const subj of SUBJECTS) {
    const existingGs = await prisma.gradeSubject.findFirst({
      where: { gradeId: GRADE_10_ID, subjectId: subj.id },
    });
    if (!existingGs) {
      await prisma.gradeSubject.create({
        data: {
          gradeId: GRADE_10_ID,
          subjectId: subj.id,
        },
      });
      console.log(`Linked ${subj.name} (${subj.code}) to Grade 10`);
    } else {
      console.log(`Already linked: ${subj.name}`);
    }
  }

  // 3. Ensure TeacherAssignments for Dr. Ermias for all 8 subjects in Grade 10 Section A
  console.log('--- Ensuring Teacher Assignments for Section A ---');
  for (const subj of SUBJECTS) {
    const existingTa = await prisma.teacherAssignment.findFirst({
      where: {
        gradeId: GRADE_10_ID,
        sectionId: SECTION_A_ID,
        subjectId: subj.id,
      },
    });
    if (!existingTa) {
      await prisma.teacherAssignment.create({
        data: {
          teacher_id: teacherId,
          academicYearId: ACADEMIC_YEAR_ID,
          gradeId: GRADE_10_ID,
          sectionId: SECTION_A_ID,
          subjectId: subj.id,
          role: 'SUBJECT_TEACHER',
        },
      });
      console.log(`Assigned teacher to ${subj.name}`);
    }
  }

  // 4. Create Assessments and Marks for all 4 terms & 8 subjects
  console.log('--- Creating Assessments & Marks for all 4 Terms ---');
  const termKeys = ['MID_1', 'SEM_1', 'MID_2', 'SEM_2'];
  const termIndexMap = { MID_1: 0, SEM_1: 1, MID_2: 2, SEM_2: 3 };

  for (const termKey of termKeys) {
    const termConfig = TERMS[termKey];
    const scoreIdx = termIndexMap[termKey];
    console.log(`\nProcessing term: ${termConfig.name} (${termConfig.id})...`);

    // In comprehensive report card logic:
    // mid1 & mid2 assessments must have type: 'MIDTERM' or title containing 'Mid 1' / 'Mid 2'
    // sem1 & sem2 assessments must have type: 'EXAM' and title not containing 'mid'
    const isMidterm = termConfig.isMid;
    const assessmentType = isMidterm ? 'MIDTERM' : 'EXAM';

    // Link assessments to semester 1 or 2 term id so period filter resolves cleanly:
    // Notice: Mid 1 and Sem 1 both belong to Semester 1 timeframe,
    // and Mid 2 and Sem 2 both belong to Semester 2 timeframe.
    // In gradebook.service.ts:
    // isTerm1 = tName.includes('1') || tName.includes('first')
    // isTerm2 = tName.includes('2') || tName.includes('second')
    // Let's use the exact termConfig.id (Mid 1 has name "Mid 1", Semester 1 has name "Semester 1", etc.)
    for (const subj of SUBJECTS) {
      const title = isMidterm
        ? `${subj.name} ${termConfig.name} Examination`
        : `${subj.name} ${termConfig.name} Assessment`;

      // Find or create assessment
      let assessment = await prisma.assessment.findFirst({
        where: {
          academicYearId: ACADEMIC_YEAR_ID,
          academicTermId: termConfig.id,
          gradeId: GRADE_10_ID,
          sectionId: SECTION_A_ID,
          subjectId: subj.id,
          title,
        },
      });

      if (!assessment) {
        assessment = await prisma.assessment.create({
          data: {
            academicYearId: ACADEMIC_YEAR_ID,
            academicTermId: termConfig.id,
            gradeId: GRADE_10_ID,
            sectionId: SECTION_A_ID,
            subjectId: subj.id,
            teacherId,
            title,
            type: assessmentType,
            maxScore: 100,
            weightage: 100,
            passingScore: 50,
            status: 'OPEN',
          },
        });
        console.log(`  Created assessment: ${title}`);
      }

      // Upsert marks for each student
      for (const student of STUDENT_PROFILES) {
        const score = student.scores[subj.name][scoreIdx];
        const isAbsent = false;

        const existingMark = await prisma.studentMark.findFirst({
          where: {
            assessmentId: assessment.id,
            studentId: student.id,
          },
        });

        if (existingMark) {
          await prisma.studentMark.update({
            where: { id: existingMark.id },
            data: { score, isAbsent, status: 'PRESENT' },
          });
        } else {
          await prisma.studentMark.create({
            data: {
              assessmentId: assessment.id,
              studentId: student.id,
              score,
              isAbsent,
              status: 'PRESENT',
            },
          });
        }
      }

      // Ensure AssessmentSubmissionRecord is APPROVED for report card readiness validation
      await prisma.assessmentSubmissionRecord.upsert({
        where: {
          academicYearId_academicTermId_gradeId_sectionId_subjectId: {
            academicYearId: ACADEMIC_YEAR_ID,
            academicTermId: termConfig.id,
            gradeId: GRADE_10_ID,
            sectionId: SECTION_A_ID,
            subjectId: subj.id,
          },
        },
        update: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
        create: {
          academicYearId: ACADEMIC_YEAR_ID,
          academicTermId: termConfig.id,
          gradeId: GRADE_10_ID,
          sectionId: SECTION_A_ID,
          subjectId: subj.id,
          teacherId,
          status: 'APPROVED',
          submittedAt: new Date(),
          reviewedAt: new Date(),
        },
      });
    }

    // 5. Create / Update ReportCard and ReportCardSubjectScore for each student in this term
    console.log(`\n--- Upserting Report Cards for Term: ${termConfig.name} ---`);
    for (const student of STUDENT_PROFILES) {
      const termStatus = student.statuses[termKey];
      const subjectScoresList = SUBJECTS.map((subj) => {
        const score = student.scores[subj.name][scoreIdx];
        const scale = getGradeLetterAndGpa(score);
        return {
          subjectId: subj.id,
          score,
          maxScore: 100,
          gradeLetter: scale.letter,
          gpaPoint: scale.gpa,
          status: 'APPROVED',
        };
      });

      const totalScore = Math.round(subjectScoresList.reduce((acc, s) => acc + s.score, 0) * 10) / 10;
      const averageScore = Math.round((totalScore / subjectScoresList.length) * 10) / 10;
      const totalGpa = subjectScoresList.reduce((acc, s) => acc + (s.gpaPoint || 0), 0);
      const gpa = Math.round((totalGpa / subjectScoresList.length) * 100) / 100;

      const reportCard = await prisma.reportCard.upsert({
        where: {
          studentId_academicYearId_academicTermId: {
            studentId: student.id,
            academicYearId: ACADEMIC_YEAR_ID,
            academicTermId: termConfig.id,
          },
        },
        update: {
          gradeId: GRADE_10_ID,
          sectionId: SECTION_A_ID,
          totalScore,
          maxPossibleScore: 800,
          averageScore,
          gpa,
          rank: student.rank,
          totalStudentsInClass: STUDENT_PROFILES.length,
          attendancePresentDays: student.attendance.present,
          attendanceTotalDays: student.attendance.total,
          conduct: student.conduct,
          homeroomTeacherComment: student.teacherComment,
          principalComment: student.principalComment,
          status: termStatus,
          publishedAt: termStatus === 'PUBLISHED' ? new Date() : null,
        },
        create: {
          studentId: student.id,
          academicYearId: ACADEMIC_YEAR_ID,
          academicTermId: termConfig.id,
          gradeId: GRADE_10_ID,
          sectionId: SECTION_A_ID,
          totalScore,
          maxPossibleScore: 800,
          averageScore,
          gpa,
          rank: student.rank,
          totalStudentsInClass: STUDENT_PROFILES.length,
          attendancePresentDays: student.attendance.present,
          attendanceTotalDays: student.attendance.total,
          conduct: student.conduct,
          homeroomTeacherComment: student.teacherComment,
          principalComment: student.principalComment,
          status: termStatus,
          publishedAt: termStatus === 'PUBLISHED' ? new Date() : null,
        },
      });

      for (const subjScore of subjectScoresList) {
        await prisma.reportCardSubjectScore.upsert({
          where: {
            reportCardId_subjectId: {
              reportCardId: reportCard.id,
              subjectId: subjScore.subjectId,
            },
          },
          update: {
            score: subjScore.score,
            maxScore: subjScore.maxScore,
            gradeLetter: subjScore.gradeLetter,
            gpaPoint: subjScore.gpaPoint,
            status: 'APPROVED',
          },
          create: {
            reportCardId: reportCard.id,
            subjectId: subjScore.subjectId,
            score: subjScore.score,
            maxScore: subjScore.maxScore,
            gradeLetter: subjScore.gradeLetter,
            gpaPoint: subjScore.gpaPoint,
            status: 'APPROVED',
          },
        });
      }

      console.log(`  Report Card: ${student.name.padEnd(18)} | Term: ${termConfig.name.padEnd(10)} | Avg: ${averageScore}% | Status: ${termStatus} | Outcome: ${student.outcome}`);
    }
  }

  console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
