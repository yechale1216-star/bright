import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres.twwmcoqipwqihlhxczvq:%40Muluye5612@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function seedAcademicReportData() {
  console.log('🌱 Starting Academic Reports Seeding...');

  // 1. Fetch current Academic Year & Semester 1
  const currentAY = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    include: { terms: true }
  });

  if (!currentAY) {
    throw new Error('No current academic year found!');
  }

  const term1 = currentAY.terms.find(t => t.name.includes('1')) || currentAY.terms[0];
  console.log(`Academic Year: ${currentAY.name} (${currentAY.id})`);
  console.log(`Academic Term: ${term1.name} (${term1.id})`);

  // Ensure term is marked current for the year
  await prisma.academicTerm.update({
    where: { id: term1.id },
    data: { isCurrent: true }
  });

  // 2. Fetch Grade 10 and its Sections
  const grade10 = await prisma.grade.findFirst({
    where: { name: { contains: '10' } },
    include: { sections: true }
  });

  if (!grade10 || grade10.sections.length === 0) {
    throw new Error('Grade 10 not found or has no sections!');
  }

  const sectionA = grade10.sections.find(s => s.name === 'A') || grade10.sections[0];
  const sectionB = grade10.sections.find(s => s.name === 'B') || grade10.sections[1] || sectionA;

  console.log(`Grade: ${grade10.name} (${grade10.id})`);
  console.log(`Section A: ${sectionA.name} (${sectionA.id})`);
  console.log(`Section B: ${sectionB.name} (${sectionB.id})`);

  // 3. Define target student list with diverse Ethiopian names
  const studentSeeds = [
    // Section A
    { name: 'Abebe Bikila', gender: 'Male', sectionId: sectionA.id, baseAbility: 85 },
    { name: 'Almaz Ayana', gender: 'Female', sectionId: sectionA.id, baseAbility: 92 },
    { name: 'Kenenisa Bekele', gender: 'Male', sectionId: sectionA.id, baseAbility: 78 },
    { name: 'Derartu Tulu', gender: 'Female', sectionId: sectionA.id, baseAbility: 88 },
    { name: 'Haile Gebrselassie', gender: 'Male', sectionId: sectionA.id, baseAbility: 95 },
    { name: 'Tirunesh Dibaba', gender: 'Female', sectionId: sectionA.id, baseAbility: 90 },
    { name: 'Yifter Miruts', gender: 'Male', sectionId: sectionA.id, baseAbility: 72 },
    { name: 'Meseret Defar', gender: 'Female', sectionId: sectionA.id, baseAbility: 84 },
    // Section B
    { name: 'Solomon Tadesse', gender: 'Male', sectionId: sectionB.id, baseAbility: 81 },
    { name: 'Bethlehem Demisse', gender: 'Female', sectionId: sectionB.id, baseAbility: 89 },
    { name: 'Dawit Tsige', gender: 'Male', sectionId: sectionB.id, baseAbility: 68 },
    { name: 'Hanna Kebede', gender: 'Female', sectionId: sectionB.id, baseAbility: 94 },
    { name: 'Natnael Girma', gender: 'Male', sectionId: sectionB.id, baseAbility: 75 },
    { name: 'Selamawit Tefera', gender: 'Female', sectionId: sectionB.id, baseAbility: 86 },
    { name: 'Yohannes Wolde', gender: 'Male', sectionId: sectionB.id, baseAbility: 62 },
    { name: 'Rahel Assefa', gender: 'Female', sectionId: sectionB.id, baseAbility: 79 },
  ];

  const createdStudents: Array<{ id: string; name: string; sectionId: string; baseAbility: number }> = [];

  for (let i = 0; i < studentSeeds.length; i++) {
    const s = studentSeeds[i];
    const studentCode = `ST-2019-10-${String(i + 1).padStart(3, '0')}`;

    let student = await prisma.student.findFirst({
      where: { fullName: s.name, gradeId: grade10.id }
    });

    if (!student) {
      student = await prisma.student.create({
        data: {
          fullName: s.name,
          student_id: studentCode,
          gender: s.gender,
          gradeId: grade10.id,
          sectionId: s.sectionId,
          status: 'ACTIVE',
          accountStatus: 'ACTIVE',
          parent_name: `Parent of ${s.name}`,
          parent_phone: `+251911${String(100000 + i)}`,
          parent_email: `parent${i + 1}@example.com`,
        }
      });
      console.log(`Created student: ${s.name} (${student.id}) in Section ${s.sectionId === sectionA.id ? 'A' : 'B'}`);
    } else {
      await prisma.student.update({
        where: { id: student.id },
        data: { sectionId: s.sectionId, status: 'ACTIVE' }
      });
    }

    // Ensure StudentAcademicYearRecord exists for current AY
    const existingRec = await prisma.studentAcademicYearRecord.findFirst({
      where: {
        studentId: student.id,
        academicYearId: currentAY.id
      }
    });

    if (!existingRec) {
      await prisma.studentAcademicYearRecord.create({
        data: {
          studentId: student.id,
          academicYearId: currentAY.id,
          gradeId: grade10.id,
          sectionId: s.sectionId,
          status: 'ENROLLED',
        }
      });
    }

    createdStudents.push({
      id: student.id,
      name: s.name,
      sectionId: s.sectionId,
      baseAbility: s.baseAbility
    });
  }

  // 4. Resolve Subjects (English, Maths/Mathematics, Physics, Chemistry, Biology)
  const allSubjects = await prisma.subject.findMany();
  const getSubject = (names: string[]) => allSubjects.find(sub => names.some(n => sub.name.toLowerCase().includes(n.toLowerCase())));

  const targetSubjects = [
    getSubject(['Maths', 'Mathematics']),
    getSubject(['English']),
    getSubject(['Physics']),
    getSubject(['Chemistry']),
    getSubject(['Biology']),
  ].filter(Boolean) as any[];

  console.log(`Found ${targetSubjects.length} target subjects:`, targetSubjects.map(s => s.name));

  // 5. Teacher for assessments
  const teacher = await prisma.teacher.findFirst();

  // 6. Create Standard Assessment Types for each subject:
  // - Midterm Exam (weight 30, max 30)
  // - Assignment / Continuous Assessment (weight 20, max 20)
  // - Final Exam (weight 50, max 50)
  const assessmentConfigs = [
    { title: 'Midterm Exam', type: 'EXAM', maxScore: 30, weightage: 30, passingScore: 15 },
    { title: 'Continuous Assessment & Quizzes', type: 'ASSIGNMENT', maxScore: 20, weightage: 20, passingScore: 10 },
    { title: 'Final Semester Examination', type: 'EXAM', maxScore: 50, weightage: 50, passingScore: 25 },
  ];

  for (const subject of targetSubjects) {
    // We create grade-level assessments (with sectionId null or section-specific)
    for (const sec of [sectionA, sectionB]) {
      for (const config of assessmentConfigs) {
        const title = `${subject.name} - ${config.title} (Sec ${sec.name})`;

        let assessment = await prisma.assessment.findFirst({
          where: {
            academicYearId: currentAY.id,
            academicTermId: term1.id,
            gradeId: grade10.id,
            sectionId: sec.id,
            subjectId: subject.id,
            title: title
          }
        });

        if (!assessment) {
          assessment = await prisma.assessment.create({
            data: {
              academicYearId: currentAY.id,
              academicTermId: term1.id,
              gradeId: grade10.id,
              sectionId: sec.id,
              subjectId: subject.id,
              teacherId: teacher?.id,
              title: title,
              type: config.type,
              maxScore: config.maxScore,
              weightage: config.weightage,
              passingScore: config.passingScore,
              status: 'PUBLISHED',
              publishedAt: new Date(),
              approvedAt: new Date(),
              submittedAt: new Date(),
            }
          });
        }

        // Add marks for each student in this section
        const sectionStudents = createdStudents.filter(st => st.sectionId === sec.id);

        for (const st of sectionStudents) {
          // Generate score proportional to ability with slight variation
          const factor = (st.baseAbility / 100) + (Math.sin(st.name.length + subject.name.length) * 0.08);
          const clampedFactor = Math.max(0.45, Math.min(0.98, factor));
          const score = Math.round(config.maxScore * clampedFactor * 10) / 10;

          await prisma.studentMark.upsert({
            where: {
              assessmentId_studentId: {
                assessmentId: assessment.id,
                studentId: st.id
              }
            },
            create: {
              assessmentId: assessment.id,
              studentId: st.id,
              score: score,
              status: 'PRESENT',
              isAbsent: false,
              remarks: score >= config.maxScore * 0.85 ? 'Excellent work' : score >= config.maxScore * 0.6 ? 'Good effort' : 'Needs improvement',
            },
            update: {
              score: score,
              status: 'PRESENT',
              isAbsent: false
            }
          });
        }
      }
    }
  }

  console.log('✅ Assessments & Marks successfully seeded for Grade 10 Sections A & B!');

  // 7. Generate Official ReportCards using gradebookService
  console.log('📊 Generating ReportCards for Grade 10 Sections A & B...');
  const { gradebookService } = require('../services/gradebook.service');

  try {
    const resA = await gradebookService.generateReportCards({
      gradeId: grade10.id,
      sectionId: sectionA.id,
      academicYearId: currentAY.id,
      academicTermId: term1.id
    });
    console.log(`Generated ReportCards for Section A.`);
  } catch (err: any) {
    console.warn('ReportCard generation notice for Sec A:', err?.message || err);
  }

  try {
    const resB = await gradebookService.generateReportCards({
      gradeId: grade10.id,
      sectionId: sectionB.id,
      academicYearId: currentAY.id,
      academicTermId: term1.id
    });
    console.log(`Generated ReportCards for Section B.`);
  } catch (err: any) {
    console.warn('ReportCard generation notice for Sec B:', err?.message || err);
  }

  console.log('🎉 Academic Report seed data generation completed successfully!');
}

seedAcademicReportData()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
