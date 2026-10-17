import prisma from '../src/config/db';
import { gradebookService } from '../src/services/gradebook.service';

async function seed() {
  console.log('====================================================');
  console.log('🌟 SEEDING REALISTIC REPORT CARDS FOR GRADE 10 SECTION A');
  console.log('====================================================\n');

  // 1. Resolve Academic Year and Term
  let academicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    include: { terms: { orderBy: { startDate: 'asc' } } }
  });
  if (!academicYear) {
    academicYear = await prisma.academicYear.findFirst({
      include: { terms: { orderBy: { startDate: 'asc' } } }
    });
  }
  if (!academicYear || academicYear.terms.length === 0) {
    throw new Error('No academic year or terms found in database');
  }

  const term1 = academicYear.terms[0];
  const term2 = academicYear.terms[1] || null;
  console.log(`Academic Year: ${academicYear.name} (id: ${academicYear.id})`);
  console.log(`Term 1: ${term1.name} (id: ${term1.id})`);
  if (term2) console.log(`Term 2: ${term2.name} (id: ${term2.id})`);

  // 2. Resolve Grade 10 and Section A
  const grade10 = await prisma.grade.findFirst({
    where: { name: { contains: '10' } }
  });
  if (!grade10) throw new Error('Grade 10 not found');

  const sectionA = await prisma.section.findFirst({
    where: { name: 'A' }
  });
  if (!sectionA) throw new Error('Section A not found');

  console.log(`Target: Grade ${grade10.name} (id: ${grade10.id}) Section ${sectionA.name} (id: ${sectionA.id})`);

  // 3. Resolve active students in Grade 10 Section A
  const students = await prisma.student.findMany({
    where: { gradeId: grade10.id, sectionId: sectionA.id, status: 'ACTIVE' },
    orderBy: { fullName: 'asc' }
  });
  console.log(`Found ${students.length} active students in Grade 10 Section A:`);
  students.forEach((s, idx) => console.log(` ${idx + 1}. ${s.fullName} (id: ${s.id})`));

  if (students.length === 0) {
    throw new Error('No students found in Grade 10 Section A');
  }

  // 4. Resolve Subjects (ensure standard subjects exist)
  const standardSubjects = [
    { name: 'English', code: 'ENG10' },
    { name: 'Mathematics', code: 'MATH10' },
    { name: 'Physics', code: 'PHY10' },
    { name: 'Chemistry', code: 'CHEM10' },
    { name: 'Biology', code: 'BIO10' },
    { name: 'History', code: 'HIST10' },
    { name: 'Geography', code: 'GEO10' },
    { name: 'Information Technology', code: 'IT10' },
    { name: 'Citizenship', code: 'CIT10' },
    { name: 'Physical Education', code: 'PE10' },
  ];

  const subjectEntities: any[] = [];
  for (const s of standardSubjects) {
    let subj = await prisma.subject.findFirst({
      where: {
        OR: [
          { name: { equals: s.name, mode: 'insensitive' } },
          { code: { equals: s.code, mode: 'insensitive' } }
        ]
      }
    });
    if (!subj) {
      subj = await prisma.subject.create({
        data: {
          name: s.name,
          code: s.code,
          isActive: true
        }
      });
      console.log(`Created subject: ${subj.name}`);
    }
    subjectEntities.push(subj);

    // Ensure assigned to Grade 10
    const existingGs = await prisma.gradeSubject.findFirst({
      where: { gradeId: grade10.id, subjectId: subj.id, streamId: null }
    });
    if (!existingGs) {
      await prisma.gradeSubject.create({
        data: {
          gradeId: grade10.id,
          subjectId: subj.id,
          streamId: null,
          sectionId: null
        }
      });
      console.log(`Assigned ${subj.name} to Grade 10`);
    }
  }

  // 5. Get a teacher or admin user to act as reviewer/teacher
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['admin', 'school_admin', 'super_admin'] } }
  });
  const reviewerId = adminUser ? adminUser.id : undefined;

  // Base score profiles for students (for realistic differentiation)
  const scoreProfiles: Record<string, number> = {
    'Amanuel': 92,
    'Bereket': 84,
    'Mekilit': 78,
    'Sara': 72,
  };

  // Seed assessments & marks for Term 1 (and Term 2 if available)
  const termsToSeed = [term1];
  if (term2) termsToSeed.push(term2);

  for (const term of termsToSeed) {
    console.log(`\n--- Seeding Assessments & Marks for ${term.name} ---`);

    for (let subjIdx = 0; subjIdx < subjectEntities.length; subjIdx++) {
      const subj = subjectEntities[subjIdx];

      // Create or find assessment
      let assessment = await prisma.assessment.findFirst({
        where: {
          gradeId: grade10.id,
          subjectId: subj.id,
          academicYearId: academicYear.id,
          academicTermId: term.id,
          sectionId: sectionA.id,
        }
      });

      if (!assessment) {
        assessment = await prisma.assessment.findFirst({
          where: {
            gradeId: grade10.id,
            subjectId: subj.id,
            academicYearId: academicYear.id,
            academicTermId: term.id,
            sectionId: null,
          }
        });
      }

      if (!assessment) {
        assessment = await prisma.assessment.create({
          data: {
            title: `${subj.name} ${term.name} Assessment`,
            type: 'EXAM',
            maxScore: 100,
            weightage: 100,
            gradeId: grade10.id,
            sectionId: sectionA.id,
            subjectId: subj.id,
            academicYearId: academicYear.id,
            academicTermId: term.id,
            status: 'APPROVED',
          }
        });
      } else {
        await prisma.assessment.update({
          where: { id: assessment.id },
          data: { status: 'APPROVED' }
        });
      }

      // Populate student marks
      for (let sIdx = 0; sIdx < students.length; sIdx++) {
        const student = students[sIdx];
        const firstName = student.fullName.split(' ')[0];
        const base = scoreProfiles[firstName] || (75 + ((sIdx * 7) % 20));
        // Add subject variation: -5 to +5 based on subject index
        const variation = ((subjIdx * 3 + sIdx * 5) % 11) - 5;
        const finalScore = Math.min(100, Math.max(50, base + variation));

        await prisma.studentMark.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: assessment.id,
              studentId: student.id,
            },
          },
          update: {
            score: finalScore,
            isAbsent: false,
            status: 'PRESENT',
            gradedById: reviewerId,
          },
          create: {
            assessmentId: assessment.id,
            studentId: student.id,
            score: finalScore,
            isAbsent: false,
            status: 'PRESENT',
            gradedById: reviewerId,
          },
        });
      }

      // Create / Update AssessmentSubmissionRecord as APPROVED
      const teacher = await prisma.user.findFirst({ where: { role: 'teacher' } }) || adminUser;
      const teacherId = teacher?.teacher_id || teacher?.id || 'default-teacher';

      await prisma.assessmentSubmissionRecord.upsert({
        where: {
          academicYearId_academicTermId_gradeId_sectionId_subjectId: {
            academicYearId: academicYear.id,
            academicTermId: term.id,
            gradeId: grade10.id,
            sectionId: sectionA.id,
            subjectId: subj.id,
          },
        },
        update: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          publishedAt: new Date(),
        },
        create: {
          academicYearId: academicYear.id,
          academicTermId: term.id,
          gradeId: grade10.id,
          sectionId: sectionA.id,
          subjectId: subj.id,
          teacherId,
          status: 'APPROVED',
          submittedAt: new Date(),
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          publishedAt: new Date(),
        },
      });
    }

    // 6. Generate Official Report Cards via gradebookService
    console.log(`Generating report cards for Grade 10 Section A - ${term.name}...`);
    await gradebookService.generateReportCards({
      gradeId: grade10.id,
      sectionId: sectionA.id,
      academicYearId: academicYear.id,
      academicTermId: term.id,
    });
  }

  // 7. Enhance Report Cards with comments, conduct, and set to PUBLISHED
  const term1Cards = await prisma.reportCard.findMany({
    where: {
      gradeId: grade10.id,
      sectionId: sectionA.id,
      academicYearId: academicYear.id,
      academicTermId: term1.id,
    },
    include: { student: true }
  });

  console.log(`\n--- Finalizing & Publishing ${term1Cards.length} Report Cards ---`);
  for (const card of term1Cards) {
    const sName = card.student?.fullName || '';
    let conduct = 'A';
    let teacherComment = 'Consistently demonstrates excellence in academics and behavior.';
    let principalComment = 'Promoted with high commendation. Exemplary performance!';

    if (sName.includes('Bereket')) {
      conduct = 'A';
      teacherComment = 'Very active in class, shows thorough understanding of course material.';
      principalComment = 'Strong academic record. Approved.';
    } else if (sName.includes('Mekilit')) {
      conduct = 'A-';
      teacherComment = 'Shows great enthusiasm and steady improvement. Keep up the good work.';
      principalComment = 'Good standing and commendable effort.';
    } else if (sName.includes('Sara')) {
      conduct = 'B+';
      teacherComment = 'Regular attendance and attentive in class. Additional practice in science subjects advised.';
      principalComment = 'Satisfactory progress. Encouraged to aim higher next semester.';
    }

    await prisma.reportCard.update({
      where: { id: card.id },
      data: {
        status: 'PUBLISHED',
        conduct,
        homeroomTeacherComment: teacherComment,
        principalComment: principalComment,
        publishedAt: new Date(),
        publishedById: reviewerId,
      }
    });
  }

  console.log('\n✅ Report card seeding completed successfully!\n');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding report cards:', err);
    process.exit(1);
  });
