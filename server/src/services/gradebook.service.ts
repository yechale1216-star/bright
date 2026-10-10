import prisma from '../config/db';
import { AssessmentCalculationEngine, StudentAssessmentScore, ConfiguredCategory } from './assessment-calculation.service';
import { AssessmentPolicyService } from './assessment-policy.service';

export interface GradingScaleInput {
  grade: string;
  minScore: number;
  maxScore: number;
  gpaPoint?: number;
  description?: string;
  color?: string;
  isPassing?: boolean;
}

export interface ExamInput {
  name: string;
  academicYearId: string;
  academicTermId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  status?: string;
  isPublished?: boolean;
  description?: string;
}

export interface AssessmentInput {
  examId?: string;
  academicYearId: string;
  academicTermId?: string;
  gradeId: string;
  sectionId?: string;
  subjectId: string;
  title: string;
  type?: string;
  maxScore?: number;
  weightage?: number;
  passingScore?: number;
  date?: string | Date;
  description?: string;
  categoryId?: string;
  schemeId?: string;
}

export interface BulkMarkItem {
  studentId: string;
  score: number;
  isAbsent?: boolean;
  remarks?: string;
}

export class GradebookService {
  /**
   * Ensure default grading scales exist.
   */
  async getGradingScales() {
    let scales = await prisma.gradingScale.findMany({
      orderBy: { minScore: 'desc' },
    });

    if (scales.length === 0) {
      const defaultScales = [
        { grade: 'A+', minScore: 90, maxScore: 100, gpaPoint: 4.0, description: 'Outstanding', color: '#10b981', isPassing: true },
        { grade: 'A', minScore: 85, maxScore: 89.99, gpaPoint: 4.0, description: 'Excellent', color: '#059669', isPassing: true },
        { grade: 'B+', minScore: 80, maxScore: 84.99, gpaPoint: 3.5, description: 'Very Good', color: '#0284c7', isPassing: true },
        { grade: 'B', minScore: 75, maxScore: 79.99, gpaPoint: 3.0, description: 'Good', color: '#2563eb', isPassing: true },
        { grade: 'C+', minScore: 65, maxScore: 74.99, gpaPoint: 2.5, description: 'Satisfactory', color: '#d97706', isPassing: true },
        { grade: 'C', minScore: 60, maxScore: 64.99, gpaPoint: 2.0, description: 'Average', color: '#f59e0b', isPassing: true },
        { grade: 'D', minScore: 50, maxScore: 59.99, gpaPoint: 1.0, description: 'Passing', color: '#ea580c', isPassing: true },
        { grade: 'F', minScore: 0, maxScore: 49.99, gpaPoint: 0.0, description: 'Failing', color: '#ef4444', isPassing: false },
      ];

      for (const item of defaultScales) {
        await prisma.gradingScale.create({ data: item });
      }

      scales = await prisma.gradingScale.findMany({
        orderBy: { minScore: 'desc' },
      });
    }

    return scales;
  }

  /**
   * Ensure standard Ethiopian curriculum subjects exist (13 subjects from official report card)
   */
  async ensureSubjects() {
    let subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (subjects.length === 0) {
      const defaultSubjects = [
        { name: 'Amharic', code: 'AMH', color: '#10b981' },
        { name: 'English', code: 'ENG', color: '#3b82f6' },
        { name: 'Maths', code: 'MTH', color: '#6366f1' },
        { name: 'Phy. Edu.', code: 'PED', color: '#f59e0b' },
        { name: 'Physics', code: 'PHY', color: '#8b5cf6' },
        { name: 'Chemistry', code: 'CHM', color: '#ec4899' },
        { name: 'Biology', code: 'BIO', color: '#14b8a6' },
        { name: 'History', code: 'HIS', color: '#f97316' },
        { name: 'Geography', code: 'GEO', color: '#06b6d4' },
        { name: 'Inform. Tech.', code: 'ICT', color: '#0ea5e9' },
        { name: 'Citizenship', code: 'CIT', color: '#84cc16' },
        { name: 'Economics', code: 'ECN', color: '#eab308' },
        { name: 'PVA', code: 'PVA', color: '#d946ef' },
      ];

      for (const subj of defaultSubjects) {
        await prisma.subject.upsert({
          where: { code: subj.code },
          update: {},
          create: subj,
        });
      }

      subjects = await prisma.subject.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    }

    return subjects;
  }

  async createGradingScale(data: GradingScaleInput) {
    return prisma.gradingScale.create({
      data: {
        ...data,
        minScore: Number(data.minScore),
        maxScore: Number(data.maxScore),
        gpaPoint: data.gpaPoint !== undefined ? Number(data.gpaPoint) : undefined,
      },
    });
  }

  async updateGradingScale(id: string, data: Partial<GradingScaleInput>) {
    return prisma.gradingScale.update({
      where: { id },
      data: {
        ...data,
        minScore: data.minScore !== undefined ? Number(data.minScore) : undefined,
        maxScore: data.maxScore !== undefined ? Number(data.maxScore) : undefined,
        gpaPoint: data.gpaPoint !== undefined ? Number(data.gpaPoint) : undefined,
      },
    });
  }

  async deleteGradingScale(id: string) {
    return prisma.gradingScale.delete({ where: { id } });
  }

  /**
   * Exams
   */
  async getExams(filters?: { academicYearId?: string; academicTermId?: string }) {
    const where: any = {};
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.academicTermId) where.academicTermId = filters.academicTermId;

    return prisma.exam.findMany({
      where,
      include: {
        academicYear: { select: { id: true, name: true } },
        academicTerm: { select: { id: true, name: true } },
        _count: { select: { assessments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createExam(data: ExamInput) {
    return prisma.exam.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        academicYear: true,
        academicTerm: true,
      },
    });
  }

  async updateExam(id: string, data: Partial<ExamInput>) {
    return prisma.exam.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        academicYear: true,
        academicTerm: true,
      },
    });
  }

  async deleteExam(id: string) {
    return prisma.exam.delete({ where: { id } });
  }

  /**
   * Assessments
   */
  async getAssessments(filters: {
    examId?: string;
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    academicYearId?: string;
    academicTermId?: string;
  }) {
    const where: any = {};
    if (filters.examId) where.examId = filters.examId;
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.academicTermId) where.academicTermId = filters.academicTermId;

    return prisma.assessment.findMany({
      where,
      include: {
        exam: { select: { id: true, name: true, status: true } },
        subject: { select: { id: true, name: true, code: true, color: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        academicTerm: { select: { id: true, name: true } },
        _count: { select: { marks: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getAssessmentById(id: string) {
    return prisma.assessment.findUnique({
      where: { id },
      include: {
        exam: true,
        subject: true,
        grade: true,
        section: true,
        academicYear: true,
        academicTerm: true,
      },
    });
  }

  async createAssessment(data: AssessmentInput) {
    return prisma.assessment.create({
      data: {
        ...data,
        maxScore: data.maxScore ? Number(data.maxScore) : 100,
        weightage: data.weightage ? Number(data.weightage) : 100,
        passingScore: data.passingScore !== undefined ? Number(data.passingScore) : undefined,
        date: data.date ? new Date(data.date) : undefined,
        categoryId: data.categoryId || undefined,
        schemeId: data.schemeId || undefined,
      },
      include: {
        subject: true,
        grade: true,
        section: true,
        category: true,
      },
    });
  }

  async updateAssessment(id: string, data: Partial<AssessmentInput>) {
    return prisma.assessment.update({
      where: { id },
      data: {
        ...data,
        maxScore: data.maxScore !== undefined ? Number(data.maxScore) : undefined,
        weightage: data.weightage !== undefined ? Number(data.weightage) : undefined,
        passingScore: data.passingScore !== undefined ? Number(data.passingScore) : undefined,
        date: data.date ? new Date(data.date) : undefined,
        categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
        schemeId: data.schemeId !== undefined ? (data.schemeId || null) : undefined,
      },
      include: {
        subject: true,
        grade: true,
        section: true,
        category: true,
      },
    });
  }

  async deleteAssessment(id: string) {
    return prisma.assessment.delete({ where: { id } });
  }

  /**
   * Marks Sheet & Entry
   */
  async getMarksSheet(assessmentId: string) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        subject: true,
        grade: true,
        section: true,
        academicYear: true,
        academicTerm: true,
        exam: true,
      },
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get all students enrolled in this grade and section (if section specified)
    const studentWhere: any = {
      gradeId: assessment.gradeId,
      status: 'ACTIVE',
    };
    if (assessment.sectionId) {
      studentWhere.sectionId = assessment.sectionId;
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        student_id: true,
        fullName: true,
        gender: true,
        gradeId: true,
        sectionId: true,
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    // Get existing marks
    const existingMarks = await prisma.studentMark.findMany({
      where: { assessmentId },
    });

    const marksMap = new Map<string, any>();
    for (const m of existingMarks) {
      marksMap.set(m.studentId, m);
    }

    const studentRows = students.map((s) => {
      const mark = marksMap.get(s.id);
      return {
        student: s,
        markId: mark?.id || null,
        score: mark ? mark.score : null,
        isAbsent: mark ? mark.isAbsent : false,
        remarks: mark?.remarks || '',
        updatedAt: mark?.updatedAt || null,
      };
    });

    return {
      assessment,
      rows: studentRows,
      totalStudents: students.length,
      gradedStudents: existingMarks.length,
    };
  }

  async saveBulkMarks(assessmentId: string, marks: BulkMarkItem[], gradedById?: string) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const results = [];
    for (const item of marks) {
      const score = item.isAbsent ? 0 : Math.min(Math.max(Number(item.score || 0), 0), assessment.maxScore);
      const res = await prisma.studentMark.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId,
            studentId: item.studentId,
          },
        },
        update: {
          score,
          isAbsent: !!item.isAbsent,
          remarks: item.remarks || null,
          gradedById: gradedById || null,
        },
        create: {
          assessmentId,
          studentId: item.studentId,
          score,
          isAbsent: !!item.isAbsent,
          remarks: item.remarks || null,
          gradedById: gradedById || null,
        },
      });
      results.push(res);
    }

    return {
      count: results.length,
      assessmentId,
    };
  }

  async getStudentMarks(studentId: string, academicYearId?: string, academicTermId?: string) {
    const where: any = { studentId };
    if (academicYearId || academicTermId) {
      where.assessment = {};
      if (academicYearId) where.assessment.academicYearId = academicYearId;
      if (academicTermId) where.assessment.academicTermId = academicTermId;
    }

    return prisma.studentMark.findMany({
      where,
      include: {
        assessment: {
          include: {
            subject: true,
            exam: true,
            academicYear: true,
            academicTerm: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Report Cards Calculation & Generation
   */
  async generateReportCards(params: {
    gradeId: string;
    sectionId: string;
    academicYearId: string;
    academicTermId: string;
  }) {
    const { gradeId, sectionId, academicYearId, academicTermId } = params;

    // 1. Get grading scales for letter conversion
    const gradingScales = await this.getGradingScales();

    const findGradeLetter = (pct: number) => {
      for (const scale of gradingScales) {
        if (pct >= scale.minScore && pct <= scale.maxScore) {
          return { letter: scale.grade, gpa: scale.gpaPoint };
        }
      }
      return { letter: 'F', gpa: 0.0 };
    };

    // 2. Find all students in this grade & section
    const students = await prisma.student.findMany({
      where: {
        gradeId,
        sectionId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        student_id: true,
        fullName: true,
      },
      orderBy: { fullName: 'asc' },
    });

    if (students.length === 0) {
      throw new Error('No active students found in the selected grade and section.');
    }

    // 3. Find all subjects assigned or available
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    });

    // 4. Find all assessments for this grade, section (or grade-wide), year, term
    const assessments = await prisma.assessment.findMany({
      where: {
        gradeId,
        academicYearId,
        academicTermId,
        OR: [{ sectionId: null }, { sectionId }],
      },
      include: {
        marks: true,
      },
    });

    // 5. Gather term attendance data for students
    const term = await prisma.academicTerm.findUnique({ where: { id: academicTermId } });
    const startDate = term ? term.startDate : new Date(Date.now() - 90 * 86400000);
    const endDate = term ? term.endDate : new Date();

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        studentId: true,
        status: true,
      },
    });

    const studentAttendanceMap = new Map<string, { present: number; total: number }>();
    for (const att of attendanceRecords) {
      const cur = studentAttendanceMap.get(att.studentId) || { present: 0, total: 0 };
      cur.total += 1;
      if (att.status === 'PRESENT' || att.status === 'LATE') {
        cur.present += 1;
      }
      studentAttendanceMap.set(att.studentId, cur);
    }

    // 6. Calculate scores per student
    const studentScoresList: Array<{
      studentId: string;
      totalScore: number;
      maxPossibleScore: number;
      averageScore: number;
      subjectScores: Array<{
        subjectId: string;
        score: number;
        maxScore: number;
        gradeLetter: string;
        gpaPoint: number;
      }>;
    }> = [];

    for (const student of students) {
      const subjectResults: Array<{
        subjectId: string;
        score: number;
        maxScore: number;
        gradeLetter: string;
        gpaPoint: number;
      }> = [];

      let studentTotal = 0;
      let studentMax = 0;

      for (const subject of subjects) {
        const subjectAssessments = assessments.filter((a) => a.subjectId === subject.id);
        if (subjectAssessments.length === 0) continue;

        let subjectWeightedSum = 0;
        let totalWeight = 0;

        for (const ass of subjectAssessments) {
          const mark = ass.marks.find((m) => m.studentId === student.id);
          const score = mark && !mark.isAbsent && mark.score != null ? mark.score : 0;
          const pct = ass.maxScore > 0 ? (score / ass.maxScore) * 100 : 0;
          const weight = ass.weightage > 0 ? ass.weightage : 100;

          subjectWeightedSum += (pct * weight) / 100;
          totalWeight += weight;
        }

        const normalizedSubjectScore = totalWeight > 0 ? (subjectWeightedSum / totalWeight) * 100 : 0;
        const roundedScore = Math.round(normalizedSubjectScore * 10) / 10;
        const { letter, gpa } = findGradeLetter(roundedScore);

        subjectResults.push({
          subjectId: subject.id,
          score: roundedScore,
          maxScore: 100,
          gradeLetter: letter,
          gpaPoint: gpa || 0,
        });

        studentTotal += roundedScore;
        studentMax += 100;
      }

      const avg = studentMax > 0 ? Math.round((studentTotal / (studentMax / 100)) * 10) / 10 : 0;

      studentScoresList.push({
        studentId: student.id,
        totalScore: Math.round(studentTotal * 10) / 10,
        maxPossibleScore: studentMax,
        averageScore: avg,
        subjectScores: subjectResults,
      });
    }

    // 7. Rank students by average score descending
    studentScoresList.sort((a, b) => b.averageScore - a.averageScore);

    const generatedReportCards = [];

    for (let i = 0; i < studentScoresList.length; i++) {
      const item = studentScoresList[i];
      const rank = i + 1;
      const att = studentAttendanceMap.get(item.studentId) || { present: 0, total: 0 };

      // Compute GPA from subjects
      const totalGpa = item.subjectScores.reduce((acc, curr) => acc + curr.gpaPoint, 0);
      const avgGpa = item.subjectScores.length > 0 ? Math.round((totalGpa / item.subjectScores.length) * 100) / 100 : 0;

      const reportCard = await prisma.reportCard.upsert({
        where: {
          studentId_academicYearId_academicTermId: {
            studentId: item.studentId,
            academicYearId,
            academicTermId,
          },
        },
        update: {
          gradeId,
          sectionId,
          totalScore: item.totalScore,
          maxPossibleScore: item.maxPossibleScore,
          averageScore: item.averageScore,
          gpa: avgGpa,
          rank,
          totalStudentsInClass: students.length,
          attendancePresentDays: att.present,
          attendanceTotalDays: att.total,
          status: 'GENERATED',
        },
        create: {
          studentId: item.studentId,
          academicYearId,
          academicTermId,
          gradeId,
          sectionId,
          totalScore: item.totalScore,
          maxPossibleScore: item.maxPossibleScore,
          averageScore: item.averageScore,
          gpa: avgGpa,
          rank,
          totalStudentsInClass: students.length,
          attendancePresentDays: att.present,
          attendanceTotalDays: att.total,
          status: 'GENERATED',
        },
      });

      // Upsert subject scores
      for (const subj of item.subjectScores) {
        await prisma.reportCardSubjectScore.upsert({
          where: {
            reportCardId_subjectId: {
              reportCardId: reportCard.id,
              subjectId: subj.subjectId,
            },
          },
          update: {
            score: subj.score,
            maxScore: subj.maxScore,
            gradeLetter: subj.gradeLetter,
            gpaPoint: subj.gpaPoint,
          },
          create: {
            reportCardId: reportCard.id,
            subjectId: subj.subjectId,
            score: subj.score,
            maxScore: subj.maxScore,
            gradeLetter: subj.gradeLetter,
            gpaPoint: subj.gpaPoint,
          },
        });
      }

      generatedReportCards.push(reportCard);
    }

    return {
      count: generatedReportCards.length,
      gradeId,
      sectionId,
      academicYearId,
      academicTermId,
    };
  }

  async getReportCards(filters: {
    gradeId?: string;
    sectionId?: string;
    academicYearId?: string;
    academicTermId?: string;
    status?: string;
  }) {
    const where: any = {};
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.academicTermId) where.academicTermId = filters.academicTermId;
    if (filters.status) where.status = filters.status;

    return prisma.reportCard.findMany({
      where,
      include: {
        student: { select: { id: true, student_id: true, fullName: true, gender: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        academicTerm: { select: { id: true, name: true } },
        subjectScores: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ rank: 'asc' }, { student: { fullName: 'asc' } }],
    });
  }

  async getReportCardById(id: string) {
    return prisma.reportCard.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            fullName: true,
            gender: true,
            parent_name: true,
            parent_phone: true,
            date_of_birth: true,
          },
        },
        grade: true,
        section: true,
        academicYear: true,
        academicTerm: true,
        subjectScores: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  async updateReportCard(
    id: string,
    data: {
      homeroomTeacherComment?: string;
      principalComment?: string;
      conduct?: string;
      status?: string;
    }
  ) {
    const updateData: any = { ...data };
    if (data.status === 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }

    return prisma.reportCard.update({
      where: { id },
      data: updateData,
      include: {
        student: true,
        grade: true,
        section: true,
        subjectScores: {
          include: { subject: true },
        },
      },
    });
  }

  async bulkUpdateStatus(ids: string[], status: string) {
    const updateData: any = { status };
    if (status === 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }

    return prisma.reportCard.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });
  }

  async getStudentReportCard(studentId: string, academicTermId?: string, academicYearId?: string) {
    const where: any = {
      studentId,
      status: { in: ['APPROVED', 'PUBLISHED'] },
    };
    if (academicTermId) where.academicTermId = academicTermId;
    if (academicYearId) where.academicYearId = academicYearId;

    return prisma.reportCard.findMany({
      where,
      include: {
        grade: true,
        section: true,
        academicYear: true,
        academicTerm: true,
        subjectScores: {
          include: { subject: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get dynamic, comprehensive report card data matching Addis Hiwot official layout
   */
  async getComprehensiveReportCardData(params: {
    studentId: string;
    academicYearId?: string;
    academicTermId?: string;
  }) {
    const { studentId, academicYearId, academicTermId } = params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        grade: true,
        section: true,
        user: { select: { profile_photo: true } },
      },
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Resolve Academic Year
    let targetYear = null;
    if (academicYearId) {
      targetYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        include: { terms: { orderBy: { startDate: 'asc' } } },
      });
    }
    if (!targetYear) {
      targetYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
        include: { terms: { orderBy: { startDate: 'asc' } } },
      });
    }
    if (!targetYear) {
      targetYear = await prisma.academicYear.findFirst({
        orderBy: { startDate: 'desc' },
        include: { terms: { orderBy: { startDate: 'asc' } } },
      });
    }

    // Resolve Homeroom Teacher
    const homeroomAssignment = await prisma.teacherAssignment.findFirst({
      where: {
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
        role: 'HOMEROOM_TEACHER',
      },
      include: { teacher: true },
    });

    let homeroomTeacherName = homeroomAssignment?.teacher?.name;
    if (!homeroomTeacherName) {
      const anyAssignment = await prisma.teacherAssignment.findFirst({
        where: {
          gradeId: student.gradeId,
          sectionId: student.sectionId,
        },
        include: { teacher: true },
      });
      homeroomTeacherName = anyAssignment?.teacher?.name || 'Anteeh Addisu Legesse';
    }

    // Resolve School Settings
    const settings = await prisma.schoolSettings.findUnique({ where: { id: 'singleton' } });
    const school = {
      name: settings?.school_name || 'Bright Path School',
      amharicName: 'ብራይት ፓዝ ት/ቤት',
      address: settings?.school_address || 'Dire Dawa',
      phone: settings?.school_phone || '0251 - 11 41 87 / 1838',
      logo: settings?.school_logo || '/bright-path-logo.png',
    };

    // Calculate Student Age
    let studentAge = 14;
    if (student.date_of_birth) {
      const dob = new Date(student.date_of_birth);
      if (!isNaN(dob.getTime())) {
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        const calculated = Math.abs(ageDt.getUTCFullYear() - 1970);
        if (calculated >= 4 && calculated <= 30) {
          studentAge = calculated;
        }
      }
    }

    // Ensure Standard Subjects
    const allSubjects = await this.ensureSubjects();

    // Standard high school order
    const standardOrder = [
      'Amharic',
      'English',
      'Maths',
      'Phy. Edu.',
      'Physics',
      'Chemistry',
      'Biology',
      'History',
      'Geography',
      'Inform. Tech.',
      'Citizenship',
      'Economics',
      'PVA',
    ];

    const sortedSubjects = [...allSubjects].sort((a, b) => {
      const idxA = standardOrder.findIndex((s) => s.toLowerCase() === a.name.toLowerCase() || a.name.toLowerCase().includes(s.toLowerCase()));
      const idxB = standardOrder.findIndex((s) => s.toLowerCase() === b.name.toLowerCase() || b.name.toLowerCase().includes(s.toLowerCase()));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    // Define Periods (Columns)
    const isSingleTerm = academicTermId && academicTermId !== 'all' && academicTermId !== 'annual';
    let periods = [
      { id: 'mid1', label: '1st Mid' },
      { id: 'sem1', label: '1st Semester' },
      { id: 'mid2', label: '2nd Mid' },
      { id: 'sem2', label: '2nd Semester' },
    ];

    if (isSingleTerm) {
      const termObj = targetYear?.terms?.find((t) => t.id === academicTermId);
      const isSem2 = termObj && termObj.name.includes('2');
      if (isSem2) {
        periods = [
          { id: 'mid2', label: '2nd Mid' },
          { id: 'sem2', label: '2nd Semester' },
        ];
      } else {
        periods = [
          { id: 'mid1', label: '1st Mid' },
          { id: 'sem1', label: '1st Semester' },
        ];
      }
    }

    // Fetch existing report cards for student
    const reportCards = await prisma.reportCard.findMany({
      where: {
        studentId: student.id,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
      },
      include: {
        academicTerm: true,
        subjectScores: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch assessments & marks for student
    const assessments = await prisma.assessment.findMany({
      where: {
        gradeId: student.gradeId,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
        OR: [{ sectionId: null }, { sectionId: student.sectionId }],
      },
      include: {
        marks: { where: { studentId: student.id } },
        subject: true,
        academicTerm: true,
      },
    });

    // Attendance record
    const absences = await prisma.attendance.count({
      where: {
        studentId: student.id,
        status: 'ABSENT',
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
      },
    });

    // Conduct & Remarks from latest report card
    const latestRc = reportCards[0];
    const conduct = latestRc?.conduct || 'A-';
    const teacherComment = latestRc?.homeroomTeacherComment || '';
    const principalComment = latestRc?.principalComment || '';

    // Helper to compute weighted score for an assessment collection
    const computeWeightedScore = (
      assessmentsList: typeof assessments,
      studentIdToMatch: string
    ): number | null => {
      if (!assessmentsList || assessmentsList.length === 0) return null;

      let weightedSum = 0;
      let totalWeight = 0;
      let hasGradedMark = false;

      for (const ass of assessmentsList) {
        const mark = ass.marks.find((m) => m.studentId === studentIdToMatch);
        if (!mark) continue;
        hasGradedMark = true;
        const rawScore = !mark.isAbsent && mark.score != null ? mark.score : 0;
        const max = ass.maxScore > 0 ? ass.maxScore : 100;
        const pct = (rawScore / max) * 100;
        const weight = ass.weightage > 0 ? ass.weightage : 100;

        weightedSum += (pct * weight) / 100;
        totalWeight += weight;
      }

      if (!hasGradedMark || totalWeight === 0) return null;
      return Math.round(((weightedSum / totalWeight) * 100) * 10) / 10;
    };

    const subjectRows = sortedSubjects.map((subj) => {
      const scores: Record<string, number> = {};
      const subjAssessments = assessments.filter((a) => a.subjectId === subj.id);

      periods.forEach((period) => {
        // 1. Find matching assessments for this specific period
        const matchingAssessments = subjAssessments.filter((a) => {
          const title = (a.title || '').toLowerCase();
          const type = (a.type || '').toUpperCase();
          const termName = (a.academicTerm?.name || '').toLowerCase();

          const isTerm1 = termName.includes('1') || termName.includes('first') || (!termName.includes('2') && !termName.includes('second'));
          const isTerm2 = termName.includes('2') || termName.includes('second');

          if (period.id === 'mid1') {
            if (!isTerm1) return false;
            return type === 'MIDTERM' || title.includes('1st mid') || title.includes('mid 1') || title.includes('midterm') || (type !== 'FINAL' && title.includes('mid'));
          }
          if (period.id === 'sem1') {
            if (!isTerm1) return false;
            return type === 'FINAL' || type === 'EXAM' || title.includes('1st sem') || title.includes('sem 1') || title.includes('final') || title.includes('semester') || (!title.includes('mid') && type !== 'MIDTERM');
          }
          if (period.id === 'mid2') {
            if (!isTerm2) return false;
            return type === 'MIDTERM' || title.includes('2nd mid') || title.includes('mid 2') || title.includes('midterm') || (type !== 'FINAL' && title.includes('mid'));
          }
          if (period.id === 'sem2') {
            if (!isTerm2) return false;
            return type === 'FINAL' || type === 'EXAM' || title.includes('2nd sem') || title.includes('sem 2') || title.includes('final') || title.includes('semester') || (!title.includes('mid') && type !== 'MIDTERM');
          }
          return false;
        });

        let score: number | null = computeWeightedScore(matchingAssessments, student.id);

        // 2. If sem1/sem2 has no specific final assessment, calculate weighted score across all assessments in that term
        if (score === null && (period.id === 'sem1' || period.id === 'sem2')) {
          const termAssessments = subjAssessments.filter((a) => {
            const termName = (a.academicTerm?.name || '').toLowerCase();
            return period.id === 'sem1'
              ? (termName.includes('1') || termName.includes('first') || (!termName.includes('2') && !termName.includes('second')))
              : (termName.includes('2') || termName.includes('second'));
          });
          score = computeWeightedScore(termAssessments, student.id);
        }

        // 3. If still null, check saved official report card subject score
        if (score === null) {
          const rcMatch = reportCards.find((rc) => {
            const termName = (rc.academicTerm?.name || '').toLowerCase();
            if (period.id.includes('1') && (termName.includes('1') || termName.includes('first'))) return true;
            if (period.id.includes('2') && (termName.includes('2') || termName.includes('second'))) return true;
            return false;
          });
          const subjScoreMatch = rcMatch?.subjectScores.find((ss) => ss.subjectId === subj.id);
          if (subjScoreMatch && subjScoreMatch.score !== undefined && subjScoreMatch.score !== null) {
            score = Math.round(subjScoreMatch.score * 10) / 10;
          }
        }

        // 4. Default to 0 if no real marks exist (no fake scores generated)
        scores[period.id] = score !== null ? score : 0;
      });

      const periodValues = periods.map((p) => scores[p.id] || 0);
      const rowTotal = periodValues.reduce((a, b) => a + b, 0);
      const rowAverage = periodValues.length > 0 ? Math.round((rowTotal / periodValues.length) * 10) / 10 : 0;

      return {
        subjectId: subj.id,
        subjectName: subj.name,
        code: subj.code,
        weight: 100,
        scores,
        total: rowTotal,
        average: rowAverage,
      };
    });

    // Column Totals
    const columnTotals: Record<string, number> = {};
    const columnAverages: Record<string, number> = {};

    periods.forEach((p) => {
      const sum = subjectRows.reduce((acc, row) => acc + (row.scores[p.id] || 0), 0);
      columnTotals[p.id] = sum;
      columnAverages[p.id] = subjectRows.length > 0 ? Math.round((sum / subjectRows.length) * 10) / 10 : 0;
    });

    const totalPointsSum = subjectRows.reduce((acc, row) => acc + row.total, 0);
    const totalAverageSum = subjectRows.reduce((acc, row) => acc + row.average, 0);
    const overallAverage = subjectRows.length > 0 ? Math.round((totalAverageSum / subjectRows.length) * 10) / 10 : 0;

    columnTotals['total'] = totalPointsSum;
    columnTotals['average'] = Math.round(totalAverageSum * 10) / 10;
    columnAverages['overall'] = overallAverage;

    // Class Standing & Section Size
    const sectionStudentsCount = await prisma.student.count({
      where: {
        gradeId: student.gradeId,
        sectionId: student.sectionId,
        status: 'ACTIVE',
      },
    });

    const totalStudentsInClass = sectionStudentsCount > 0 ? sectionStudentsCount : 1;
    const studentRank = latestRc?.rank || 1;
    const rankDisplay = `${studentRank}/${totalStudentsInClass}`;

    // Status / Remark badge
    const remarkBadge = overallAverage >= 50 ? 'Passed' : 'Needs Improvement';

    // Verifiable QR Code payload
    const reportCardId = latestRc?.id ? `AH-RC-${latestRc.id.substring(0, 8).toUpperCase()}` : `AH-RC-${student.student_id}-2018`;
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const qrVerificationPayload = JSON.stringify({
      school: school.name,
      reportCardId,
      studentId: student.student_id,
      studentName: student.fullName,
      grade: student.grade?.name,
      section: student.section?.name,
      year: targetYear?.name || '2018 E.C.',
      average: overallAverage,
      rank: rankDisplay,
      status: remarkBadge,
      issued: issueDate,
    });

    return {
      reportCardId,
      issueDate,
      school,
      student: {
        id: student.id,
        studentId: student.student_id,
        fullName: student.fullName,
        gender: student.gender || 'M',
        age: studentAge,
        dateOfBirth: student.date_of_birth,
        photo: student.user?.profile_photo || null,
        status: student.status,
      },
      academic: {
        gradeId: student.gradeId,
        gradeName: student.grade?.name || '10 TEN',
        sectionId: student.sectionId,
        sectionName: student.section?.name || 'A',
        academicYearId: targetYear?.id || '',
        academicYearName: targetYear?.name || '2017',
        academicTermId: academicTermId || 'annual',
        academicTermName: isSingleTerm ? (targetYear?.terms?.find((t) => t.id === academicTermId)?.name || 'Semester') : 'Annual',
        homeroomTeacherName,
      },
      periods,
      subjectRows,
      summary: {
        totalRow: {
          weight: subjectRows.length * 100,
          periodSums: columnTotals,
          total: totalPointsSum,
          average: columnTotals['average'],
        },
        averageRow: {
          periodAverages: columnAverages,
          overallAverage,
        },
        rank: rankDisplay,
        conduct,
        absence: `${absences} Day`,
        remarkBadge,
        teacherComment,
        principalComment,
      },
      qrCodeData: qrVerificationPayload,
      status: latestRc?.status || 'GENERATED',
    };
  }

  /**
   * Batch get comprehensive report cards for an entire section
   */
  async getBatchComprehensiveReportCards(params: {
    gradeId: string;
    sectionId: string;
    academicYearId?: string;
    academicTermId?: string;
  }) {
    const { gradeId, sectionId, academicYearId, academicTermId } = params;

    const students = await prisma.student.findMany({
      where: {
        gradeId,
        sectionId,
        status: 'ACTIVE',
      },
      select: { id: true },
      orderBy: { fullName: 'asc' },
    });

    const results = [];
    for (const s of students) {
      const card = await this.getComprehensiveReportCardData({
        studentId: s.id,
        academicYearId,
        academicTermId,
      });
      results.push(card);
    }

    return results;
  }

  /**
   * Complete unified class gradebook matrix with percentage-weighted calculations
   */
  async getClassGradebook(params: {
    academicYearId: string;
    academicTermId?: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    userId?: string;
  }) {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId } = params;

    // 1. Resolve Assessment Policy Scheme
    const scheme = await AssessmentPolicyService.resolveSchemeForContext({
      academicYearId,
      academicTermId,
      gradeId,
      subjectId,
    });

    const configuredCategories: ConfiguredCategory[] = (scheme?.categories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      weight: Number(c.weight),
      aggregationMethod: c.aggregationMethod as any,
    }));

    // 2. Fetch active students in this grade & section
    const students = await prisma.student.findMany({
      where: {
        gradeId,
        sectionId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        student_id: true,
        fullName: true,
        gender: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // 3. Fetch assessments for this grade, section (or grade-wide), subject, year, term
    const assessments = await prisma.assessment.findMany({
      where: {
        academicYearId,
        ...(academicTermId ? { academicTermId } : {}),
        gradeId,
        subjectId,
        OR: [{ sectionId: null }, { sectionId }],
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            weight: true,
            aggregationMethod: true,
            orderIndex: true,
          },
        },
        assessmentType: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [
        { category: { orderIndex: 'asc' } },
        { date: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // 4. Fetch all student marks for these assessments
    const assessmentIds = assessments.map((a) => a.id);
    const allMarks = assessmentIds.length > 0
      ? await prisma.studentMark.findMany({
          where: { assessmentId: { in: assessmentIds } },
        })
      : [];

    const marksMap = new Map<string, any>();
    for (const m of allMarks) {
      marksMap.set(`${m.assessmentId}_${m.studentId}`, m);
    }

    // 5. Compute calculation per student using AssessmentCalculationEngine
    const studentRows = students.map((student) => {
      const studentAssessmentScores: StudentAssessmentScore[] = assessments.map((ass) => {
        const mark = marksMap.get(`${ass.id}_${student.id}`);
        const status = mark ? (mark.isAbsent ? 'ABSENT' : mark.score !== null ? 'PRESENT' : 'NOT_ENTERED') : 'NOT_ENTERED';
        return {
          assessmentId: ass.id,
          categoryId: ass.categoryId || '',
          categoryName: ass.category?.name,
          title: ass.title,
          maxScore: ass.maxScore,
          score: mark && !mark.isAbsent ? mark.score : null,
          status,
          isAbsent: mark ? mark.isAbsent : false,
        };
      });

      const calculation = AssessmentCalculationEngine.calculateSubjectResult(
        student.id,
        configuredCategories,
        studentAssessmentScores
      );

      const marksRecord: Record<string, {
        markId: string | null;
        score: number | null;
        isAbsent: boolean;
        status: string;
        remarks: string | null;
        updatedAt: Date | null;
      }> = {};

      let studentEnteredCount = 0;
      for (const ass of assessments) {
        const mark = marksMap.get(`${ass.id}_${student.id}`);
        if (mark && (mark.score !== null || mark.isAbsent)) {
          studentEnteredCount++;
        }
        marksRecord[ass.id] = {
          markId: mark?.id || null,
          score: mark ? mark.score : null,
          isAbsent: mark ? mark.isAbsent : false,
          status: mark ? mark.status : 'NOT_ENTERED',
          remarks: mark?.remarks || null,
          updatedAt: mark?.updatedAt || null,
        };
      }

      const isComplete = assessments.length > 0 && studentEnteredCount === assessments.length;

      return {
        student,
        marks: marksRecord,
        calculation,
        isComplete,
      };
    });

    // 6. Fetch submission status record
    const submissionRecord = await prisma.assessmentSubmissionRecord.findFirst({
      where: {
        academicYearId,
        ...(academicTermId ? { academicTermId } : {}),
        gradeId,
        sectionId,
        subjectId,
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
    });

    // 7. Aggregate statistics
    let completedStudentsCount = 0;
    let missingMarksStudentsCount = 0;
    let absentStudentsCount = 0;
    const finalScoresList: number[] = [];

    for (const row of studentRows) {
      if (row.isComplete) {
        completedStudentsCount++;
      } else {
        missingMarksStudentsCount++;
      }
      if (Object.values(row.marks).some((m) => m.isAbsent)) {
        absentStudentsCount++;
      }
      if (row.calculation.provisionalScore !== null && row.calculation.provisionalScore !== undefined) {
        finalScoresList.push(row.calculation.provisionalScore);
      }
    }

    const totalStudents = students.length;
    const totalPossibleMarksEntries = totalStudents * Math.max(1, assessments.length);
    const totalActualMarksEntries = studentRows.reduce((acc, row) => {
      return acc + Object.values(row.marks).filter((m) => m.score !== null || m.isAbsent).length;
    }, 0);

    const completionPercentage = totalPossibleMarksEntries > 0
      ? Math.round((totalActualMarksEntries / totalPossibleMarksEntries) * 100)
      : 0;

    const classAverage = finalScoresList.length > 0
      ? AssessmentCalculationEngine.round(finalScoresList.reduce((a, b) => a + b, 0) / finalScoresList.length, 1)
      : 0;
    const highestScore = finalScoresList.length > 0 ? Math.max(...finalScoresList) : 0;
    const lowestScore = finalScoresList.length > 0 ? Math.min(...finalScoresList) : 0;

    // 8. Category summary breakdown with average % per category
    const categorySummaries = configuredCategories.map((cat) => {
      const catAssessments = assessments.filter((a) => a.categoryId === cat.id);
      let totalEarned = 0;
      let totalMax = 0;
      for (const ass of catAssessments) {
        for (const row of studentRows) {
          const m = row.marks[ass.id];
          if (m && m.score !== null && !m.isAbsent) {
            totalEarned += m.score;
            totalMax += ass.maxScore;
          }
        }
      }
      const avgPct = totalMax > 0 ? AssessmentCalculationEngine.round((totalEarned / totalMax) * 100, 1) : 0;

      return {
        id: cat.id,
        name: cat.name,
        weight: cat.weight,
        aggregationMethod: cat.aggregationMethod || 'COMBINED_MARKS',
        assessmentCount: catAssessments.length,
        averagePercentage: avgPct,
      };
    });

    return {
      scheme: {
        id: scheme?.id || null,
        name: scheme?.name || 'Standard Percentage Scheme',
        aggregationMethod: (scheme as any)?.aggregationMethod || 'COMBINED_MARKS',
        categories: configuredCategories,
        categorySummaries,
      },
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        maxScore: a.maxScore,
        weightage: a.weightage,
        passingScore: a.passingScore,
        categoryId: a.categoryId,
        categoryName: a.category?.name || null,
        categoryWeight: a.category?.weight || null,
        date: a.date,
        description: a.description,
        status: a.status,
      })),
      students: studentRows,
      submissionRecord: submissionRecord ? {
        id: submissionRecord.id,
        status: submissionRecord.status,
        notes: submissionRecord.notes,
        rejectionReason: submissionRecord.rejectionReason,
        submittedAt: submissionRecord.submittedAt,
        reviewedAt: submissionRecord.reviewedAt,
        publishedAt: submissionRecord.publishedAt,
        reopenedAt: submissionRecord.reopenedAt,
        reopenReason: submissionRecord.reopenReason,
        teacher: submissionRecord.teacher,
      } : null,
      statistics: {
        totalStudents,
        completedStudentsCount,
        missingMarksStudentsCount,
        absentStudentsCount,
        completionPercentage,
        classAverage,
        highestScore,
        lowestScore,
      },
    };
  }

  /**
   * Save marks across multiple assessments in a class matrix atomically
   */
  async saveClassMarks(params: {
    academicYearId: string;
    academicTermId?: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    marks: Array<{
      assessmentId: string;
      studentId: string;
      score: number | null;
      isAbsent?: boolean;
      remarks?: string;
    }>;
    gradedById?: string;
  }) {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, marks, gradedById } = params;

    // Check lock status
    const submission = await prisma.assessmentSubmissionRecord.findFirst({
      where: {
        academicYearId,
        ...(academicTermId ? { academicTermId } : {}),
        gradeId,
        sectionId,
        subjectId,
      },
    });

    if (submission && ['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes(submission.status)) {
      throw new Error(`Cannot modify marks. This gradebook is currently ${submission.status}.`);
    }

    // Load assessments to validate maxScore
    const assessmentIds = Array.from(new Set(marks.map((m) => m.assessmentId)));
    const assessments = await prisma.assessment.findMany({
      where: { id: { in: assessmentIds } },
    });
    const assessmentMap = new Map(assessments.map((a) => [a.id, a]));

    const results = await prisma.$transaction(async (tx) => {
      const updatedMarks = [];
      for (const item of marks) {
        const assess = assessmentMap.get(item.assessmentId);
        if (!assess) continue;

        let score = item.score;
        if (item.isAbsent) {
          score = 0;
        } else if (score !== null && score !== undefined) {
          score = Math.min(Math.max(Number(score), 0), assess.maxScore);
        }

        const res = await tx.studentMark.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: item.assessmentId,
              studentId: item.studentId,
            },
          },
          update: {
            score,
            isAbsent: !!item.isAbsent,
            remarks: item.remarks || null,
            gradedById: gradedById || null,
          },
          create: {
            assessmentId: item.assessmentId,
            studentId: item.studentId,
            score,
            isAbsent: !!item.isAbsent,
            remarks: item.remarks || null,
            gradedById: gradedById || null,
          },
        });
        updatedMarks.push(res);
      }

      // If submission record does not exist, create it as DRAFT
      if (!submission && academicTermId) {
        let teacherId = gradedById;
        const user = await tx.user.findUnique({ where: { id: gradedById || '' } });
        if (user?.teacher_id) teacherId = user.teacher_id;

        if (teacherId) {
          await tx.assessmentSubmissionRecord.create({
            data: {
              academicYearId,
              academicTermId,
              gradeId,
              sectionId,
              subjectId,
              teacherId,
              status: 'DRAFT',
            },
          });
        }
      }

      return updatedMarks;
    });

    return {
      count: results.length,
      updatedCount: results.length,
      success: true,
    };
  }
}

export const gradebookService = new GradebookService();
