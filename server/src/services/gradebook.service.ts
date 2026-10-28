import { academicYearService } from './academic-year.service';
import { checkStudentsBatchEligibility } from './student-eligibility.service';
import prisma from '../config/db';
import { AssessmentCalculationEngine, StudentAssessmentScore, ConfiguredCategory } from './assessment-calculation.service';
import { AssessmentPolicyService } from './assessment-policy.service';
import { evaluateStudentPromotion, findGradeScale } from '../utils/report-card-promotion';

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
   * Return all active subjects from the database.
   */
  async ensureSubjects() {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
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

    const termValidation = await academicYearService.validateMarkEntryWindow(
      assessment.academicTermId || undefined,
      assessment.academicYearId
    );
    if (!termValidation.allowed) {
      const err: any = new Error(termValidation.message || 'Mark entry is not permitted for this term');
      err.status = 403;
      err.code = termValidation.code;
      throw err;
    }

    // Get all students enrolled in this grade and section (if section specified)
    const studentWhere: any = {
      gradeId: assessment.gradeId,
      status: { in: ['ACTIVE', 'SUSPENDED'] },
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

    const termSheetValidation = await academicYearService.validateMarkEntryWindow(
      assessment.academicTermId || undefined,
      assessment.academicYearId
    );

    return {
      assessment,
      termStatus: {
        activeTermId: termSheetValidation.activeTerm?.id || null,
        activeTermName: termSheetValidation.activeTerm?.name || null,
        activeTermStartDate: termSheetValidation.activeTerm?.startDate || null,
        activeTermEndDate: termSheetValidation.activeTerm?.endDate || null,
        isMarkEntryAllowed: termSheetValidation.allowed,
        lockCode: termSheetValidation.code || null,
        lockReason: termSheetValidation.message || null,
      },
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

    // Enforce active term restriction before doing any mark work
    const termValidation = await academicYearService.validateMarkEntryWindow(
      assessment.academicTermId || undefined,
      assessment.academicYearId
    );
    if (!termValidation.allowed) {
      const err: any = new Error(termValidation.message || 'Mark entry is not permitted for this term');
      err.status = 403;
      err.code = termValidation.code;
      throw err;
    }

    if (!marks || marks.length === 0) {
      return { count: 0, assessmentId };
    }

    const uniqueStudentIds = Array.from(new Set(marks.map((m) => m.studentId).filter(Boolean)));
    const markEligibility = await checkStudentsBatchEligibility(uniqueStudentIds, 'MARK_ENTRY', {
      academicYearId: assessment.academicYearId,
      operationDate: assessment.date ? new Date(assessment.date) : new Date(),
    });

    const ineligibleMarkStudent = uniqueStudentIds.find((sid) => !markEligibility.get(sid)?.eligible);
    if (ineligibleMarkStudent) {
      const reason = markEligibility.get(ineligibleMarkStudent)?.reason || 'Student is not eligible for mark entry';
      throw new Error(`Cannot save marks: ${reason}`);
    }

    const operations = marks.map((item) => {
      const score = item.isAbsent ? 0 : Math.min(Math.max(Number(item.score || 0), 0), assessment.maxScore);
      const status = item.isAbsent ? 'ABSENT' : score !== null && score !== undefined ? 'PRESENT' : 'UNGRADED';
      return prisma.studentMark.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId,
            studentId: item.studentId,
          },
        },
        update: {
          score,
          isAbsent: !!item.isAbsent,
          status,
          remarks: item.remarks || null,
          gradedById: gradedById || null,
        },
        create: {
          assessmentId,
          studentId: item.studentId,
          score,
          isAbsent: !!item.isAbsent,
          status,
          remarks: item.remarks || null,
          gradedById: gradedById || null,
        },
      });
    });

    const BATCH_SIZE = 50;
    const results: any[] = [];
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const chunkResults = await prisma.$transaction(chunk);
      results.push(...chunkResults);
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
   * Resolve all required subjects assigned to a student's grade & section
   */
  async getRequiredSubjectsForGradeAndSection(
    gradeId: string,
    sectionId?: string,
    academicYearId?: string,
    academicTermId?: string,
    streamId?: string
  ): Promise<Array<{ id: string; name: string; code: string; color: string }>> {
    const subjectIdSet = new Set<string>();

    const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
    const isGrade11or12 = grade ? /\b(11|12)\b/.test(grade.name) : false;

    // Resolve stream if not explicitly provided
    let effectiveStreamId = streamId;
    if (!effectiveStreamId && sectionId) {
      const sectionObj = await prisma.section.findUnique({ where: { id: sectionId } });
      if (sectionObj?.streamId) {
        effectiveStreamId = sectionObj.streamId;
      }
    }

    // 1. Grade Subject assignments (Curriculum)
    const gradeSubjects = await prisma.gradeSubject.findMany({
      where: {
        gradeId,
        ...(effectiveStreamId ? { streamId: effectiveStreamId } : {}),
        ...(sectionId ? { OR: [{ sectionId: null }, { sectionId }] } : {}),
      },
      select: { subjectId: true },
    });
    for (const gs of gradeSubjects) {
      if (gs.subjectId) subjectIdSet.add(gs.subjectId);
    }

    // 2. Teacher assignments for this grade/section
    const teacherAssignments = await prisma.teacherAssignment.findMany({
      where: {
        gradeId,
        ...(sectionId ? { sectionId } : {}),
      },
      select: { subjectId: true, subject: true },
    });

    for (const ta of teacherAssignments) {
      if (ta.subjectId) {
        subjectIdSet.add(ta.subjectId);
      } else if (ta.subject) {
        const matched = await prisma.subject.findFirst({
          where: {
            OR: [
              { name: { equals: ta.subject, mode: 'insensitive' } },
              { code: { equals: ta.subject, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        });
        if (matched) subjectIdSet.add(matched.id);
      }
    }

    // 3. Assessment scheme assignments
    const schemeAssignments = await prisma.assessmentSchemeAssignment.findMany({
      where: {
        gradeId,
        ...(academicYearId ? { academicYearId } : {}),
        ...(academicTermId ? { OR: [{ academicTermId: null }, { academicTermId }] } : {}),
      },
      select: { subjectId: true },
    });
    for (const sa of schemeAssignments) {
      if (sa.subjectId) subjectIdSet.add(sa.subjectId);
    }

    // 4. Assessments created for this grade
    const assessments = await prisma.assessment.findMany({
      where: {
        gradeId,
        ...(sectionId ? { OR: [{ sectionId: null }, { sectionId }] } : {}),
        ...(academicYearId ? { academicYearId } : {}),
        ...(academicTermId ? { academicTermId } : {}),
      },
      select: { subjectId: true },
    });
    for (const a of assessments) {
      if (a.subjectId) subjectIdSet.add(a.subjectId);
    }

    // 5. Assessment submission records
    const submissionRecords = await prisma.assessmentSubmissionRecord.findMany({
      where: {
        gradeId,
        ...(sectionId ? { sectionId } : {}),
        ...(academicYearId ? { academicYearId } : {}),
        ...(academicTermId ? { academicTermId } : {}),
      },
      select: { subjectId: true },
    });
    for (const sr of submissionRecords) {
      if (sr.subjectId) subjectIdSet.add(sr.subjectId);
    }

    let subjects: any[] = [];
    if (subjectIdSet.size > 0) {
      subjects = await prisma.subject.findMany({
        where: { id: { in: Array.from(subjectIdSet) }, isActive: true },
        select: { id: true, name: true, code: true, color: true },
      });
    }

    if (subjects.length === 0) {
      // Fallback to all active subjects in school
      subjects = await prisma.subject.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, color: true },
      });
    }

    // Stream-specific filtering for Grades 11 and 12
    if (isGrade11or12 && effectiveStreamId) {
      const streamObj = await prisma.stream.findUnique({ where: { id: effectiveStreamId } });
      const streamNameLower = (streamObj?.name || '').toLowerCase();
      const isNatural = streamNameLower.includes('natural');
      const isSocial = streamNameLower.includes('social');

      // Check if explicit gradeSubjects exist for this stream
      const streamSpecificCurriculum = gradeSubjects.length > 0;

      if (streamSpecificCurriculum) {
        const curriculumSubjectIdSet = new Set(gradeSubjects.map((gs) => gs.subjectId));
        subjects = subjects.filter((s) => curriculumSubjectIdSet.has(s.id));
      } else if (isNatural) {
        // Exclude social-only subjects for natural science track
        subjects = subjects.filter((s) => {
          const n = s.name.toLowerCase();
          return !n.includes('history') && !n.includes('geography') && !n.includes('economics');
        });
      } else if (isSocial) {
        // Exclude natural-only subjects for social science track
        subjects = subjects.filter((s) => {
          const n = s.name.toLowerCase();
          return !n.includes('physics') && !n.includes('chemistry') && !n.includes('biology');
        });
      }
    }

    // Standard Addis Hiwot / Ethiopian curriculum ordering
    const SUBJECT_ORDER: Record<string, number> = {
      English: 1,
      Maths: 2,
      Mathematics: 2,
      'Phy. Edu.': 3,
      'Physical Education': 3,
      Physics: 4,
      Chemistry: 5,
      Biology: 6,
      History: 7,
      Geography: 8,
      'Inform. Tech.': 9,
      'Information Technology': 9,
      Citizenship: 10,
      Economics: 11,
      PVA: 12,
    };

    return subjects.sort((a, b) => {
      const orderA = SUBJECT_ORDER[a.name] ?? 99;
      const orderB = SUBJECT_ORDER[b.name] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Report Cards Calculation & Draft Generation
   * Never sets status to PUBLISHED — saves as DRAFT or READY.
   * Averages and totals are computed strictly across APPROVED subjects.
   */
  async generateReportCards(params: {
    gradeId: string;
    sectionId: string;
    academicYearId: string;
    academicTermId: string;
  }) {
    const { gradeId, sectionId, academicYearId, academicTermId } = params;

    const gradingScales = await this.getGradingScales();
    const findGradeLetter = (pct: number) => {
      for (const scale of gradingScales) {
        if (pct >= scale.minScore && pct <= scale.maxScore) {
          return { letter: scale.grade, gpa: scale.gpaPoint };
        }
      }
      return { letter: 'F', gpa: 0.0 };
    };

    const students = await prisma.student.findMany({
      where: { gradeId, sectionId, status: 'ACTIVE' },
      select: { id: true, student_id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });

    if (students.length === 0) {
      throw new Error('No active students found in the selected grade and section.');
    }

    // 1. Get all required subjects for this grade & section
    const requiredSubjects = await this.getRequiredSubjectsForGradeAndSection(
      gradeId,
      sectionId,
      academicYearId,
      academicTermId
    );

    // 2. Fetch all submission records for this context
    const submissionRecords = await prisma.assessmentSubmissionRecord.findMany({
      where: {
        academicYearId,
        academicTermId,
        gradeId,
        sectionId,
      },
    });

    const submissionBySubject = new Map<string, any>();
    for (const sr of submissionRecords) {
      submissionBySubject.set(sr.subjectId, sr);
    }

    // 3. Determine approval status per subject
    const subjectApprovalMap = new Map<string, { status: 'APPROVED' | 'PENDING_APPROVAL' | 'RETURNED' | 'MISSING' }>();
    for (const subj of requiredSubjects) {
      const subRecord = submissionBySubject.get(subj.id);
      if (!subRecord) {
        subjectApprovalMap.set(subj.id, { status: 'MISSING' });
      } else if (subRecord.status === 'APPROVED') {
        subjectApprovalMap.set(subj.id, { status: 'APPROVED' });
      } else if (subRecord.status === 'SUBMITTED' || subRecord.status === 'PENDING_APPROVAL') {
        subjectApprovalMap.set(subj.id, { status: 'PENDING_APPROVAL' });
      } else if (subRecord.status === 'RETURNED') {
        subjectApprovalMap.set(subj.id, { status: 'RETURNED' });
      } else {
        subjectApprovalMap.set(subj.id, { status: 'MISSING' });
      }
    }

    const allRequiredApproved =
      requiredSubjects.length > 0 &&
      requiredSubjects.every((subj) => subjectApprovalMap.get(subj.id)?.status === 'APPROVED');

    // 4. Fetch assessments
    const assessments = await prisma.assessment.findMany({
      where: {
        gradeId,
        academicYearId,
        academicTermId,
        OR: [{ sectionId: null }, { sectionId }],
      },
      include: { marks: true },
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
      select: { studentId: true, status: true },
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

    // 6. Calculate student scores
    const studentScoresList: Array<{
      studentId: string;
      totalScore: number;
      maxPossibleScore: number;
      averageScore: number;
      gpa: number;
      approvedSubjectCount: number;
      subjectScores: Array<{
        subjectId: string;
        score: number;
        maxScore: number;
        gradeLetter: string | null;
        gpaPoint: number;
        status: string;
      }>;
    }> = [];

    for (const student of students) {
      const subjectResults: Array<{
        subjectId: string;
        score: number;
        maxScore: number;
        gradeLetter: string | null;
        gpaPoint: number;
        status: string;
      }> = [];

      let studentTotal = 0;
      let approvedCount = 0;
      let totalGpaPoints = 0;

      for (const subject of requiredSubjects) {
        const approvalInfo = subjectApprovalMap.get(subject.id) || { status: 'MISSING' };
        const isApproved = approvalInfo.status === 'APPROVED';

        const subjectAssessments = assessments.filter((a) => a.subjectId === subject.id);

        let subjectScore = 0;
        let gradeLetter: string | null = null;
        let gpaPoint = 0;

        if (isApproved) {
          approvedCount += 1;
          if (subjectAssessments.length > 0) {
            let weightedSum = 0;
            let totalWeight = 0;

            for (const ass of subjectAssessments) {
              const mark = ass.marks.find((m) => m.studentId === student.id);
              const score = mark && !mark.isAbsent && mark.score != null ? mark.score : 0;
              const pct = ass.maxScore > 0 ? (score / ass.maxScore) * 100 : 0;
              const weight = ass.weightage > 0 ? ass.weightage : 100;

              weightedSum += (pct * weight) / 100;
              totalWeight += weight;
            }

            const normalized = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
            subjectScore = Math.round(normalized * 10) / 10;
            const letterRes = findGradeLetter(subjectScore);
            gradeLetter = letterRes.letter;
            gpaPoint = letterRes.gpa || 0;

            studentTotal += subjectScore;
            totalGpaPoints += gpaPoint;
          }
        }

        subjectResults.push({
          subjectId: subject.id,
          score: isApproved ? subjectScore : 0,
          maxScore: 100,
          gradeLetter: isApproved ? gradeLetter : null,
          gpaPoint: isApproved ? gpaPoint : 0,
          status: approvalInfo.status,
        });
      }

      // Calculations are strictly computed over approved subjects
      const avg = approvedCount > 0 ? Math.round((studentTotal / approvedCount) * 10) / 10 : 0;
      const gpaAvg = approvedCount > 0 ? Math.round((totalGpaPoints / approvedCount) * 100) / 100 : 0;

      studentScoresList.push({
        studentId: student.id,
        totalScore: Math.round(studentTotal * 10) / 10,
        maxPossibleScore: approvedCount * 100,
        averageScore: avg,
        gpa: gpaAvg,
        approvedSubjectCount: approvedCount,
        subjectScores: subjectResults,
      });
    }

    // 7. Rank students by average score descending
    studentScoresList.sort((a, b) => b.averageScore - a.averageScore);

    // 8. Fetch existing report cards to preserve published state or flag correction
    const existingCards = await prisma.reportCard.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        academicYearId,
        academicTermId,
      },
    });
    const existingCardMap = new Map<string, any>(existingCards.map((rc) => [rc.studentId, rc]));

    const generatedReportCards = [];

    for (let i = 0; i < studentScoresList.length; i++) {
      const item = studentScoresList[i];
      const rank = i + 1;
      const att = studentAttendanceMap.get(item.studentId) || { present: 0, total: 0 };
      const existing = existingCardMap.get(item.studentId);

      // Status determination:
      // If all required subjects are approved -> READY (or keep PUBLISHED if already published)
      // If not all approved -> DRAFT (or NEEDS_CORRECTION if it was previously published)
      let newStatus = 'DRAFT';
      if (allRequiredApproved) {
        if (existing?.status === 'PUBLISHED') {
          newStatus = 'PUBLISHED';
        } else {
          newStatus = 'READY';
        }
      } else {
        if (existing?.status === 'PUBLISHED') {
          newStatus = 'NEEDS_CORRECTION';
        } else {
          newStatus = 'DRAFT';
        }
      }

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
          gpa: item.gpa,
          rank,
          totalStudentsInClass: students.length,
          attendancePresentDays: att.present,
          attendanceTotalDays: att.total,
          status: newStatus,
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
          gpa: item.gpa,
          rank,
          totalStudentsInClass: students.length,
          attendancePresentDays: att.present,
          attendanceTotalDays: att.total,
          status: newStatus,
        },
      });

      // Upsert subject scores with status
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
            status: subj.status,
          },
          create: {
            reportCardId: reportCard.id,
            subjectId: subj.subjectId,
            score: subj.score,
            maxScore: subj.maxScore,
            gradeLetter: subj.gradeLetter,
            gpaPoint: subj.gpaPoint,
            status: subj.status,
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
      allRequiredApproved,
      requiredSubjectsCount: requiredSubjects.length,
    };
  }

  /**
   * Report Card Readiness Validation
   * Checks whether all required subjects for the student's grade/section have approved submissions
   */
  async validateReportCardReadiness(reportCardId: string) {
    const reportCard = await prisma.reportCard.findUnique({
      where: { id: reportCardId },
      include: {
        student: { select: { id: true, student_id: true, fullName: true } },
        grade: true,
        section: true,
        academicYear: true,
        academicTerm: true,
        subjectScores: { include: { subject: true } },
      },
    });

    if (!reportCard) {
      throw new Error(`Report card with ID "${reportCardId}" not found`);
    }

    const requiredSubjects = await this.getRequiredSubjectsForGradeAndSection(
      reportCard.gradeId,
      reportCard.sectionId,
      reportCard.academicYearId,
      reportCard.academicTermId
    );

    const submissionRecords = await prisma.assessmentSubmissionRecord.findMany({
      where: {
        academicYearId: reportCard.academicYearId,
        academicTermId: reportCard.academicTermId,
        gradeId: reportCard.gradeId,
        sectionId: reportCard.sectionId,
      },
      include: { subject: true, teacher: true },
    });

    const subMap = new Map<string, any>(submissionRecords.map((s) => [s.subjectId, s]));

    const blockers: string[] = [];
    const subjectDetails: Array<{
      subjectId: string;
      subjectName: string;
      code: string;
      status: 'APPROVED' | 'PENDING_APPROVAL' | 'RETURNED' | 'MISSING';
      teacherName?: string;
      reason?: string;
    }> = [];

    let approvedCount = 0;
    let pendingCount = 0;
    let missingCount = 0;

    for (const reqSub of requiredSubjects) {
      const sub = subMap.get(reqSub.id);
      if (!sub) {
        missingCount++;
        blockers.push(`Subject "${reqSub.name}" has no mark submission.`);
        subjectDetails.push({
          subjectId: reqSub.id,
          subjectName: reqSub.name,
          code: reqSub.code,
          status: 'MISSING',
          reason: 'No mark submission created by teacher',
        });
      } else if (sub.status === 'APPROVED') {
        approvedCount++;
        subjectDetails.push({
          subjectId: reqSub.id,
          subjectName: reqSub.name,
          code: reqSub.code,
          status: 'APPROVED',
          teacherName: sub.teacher?.name,
        });
      } else if (sub.status === 'SUBMITTED' || sub.status === 'PENDING_APPROVAL') {
        pendingCount++;
        blockers.push(`Subject "${reqSub.name}" is pending administrative approval.`);
        subjectDetails.push({
          subjectId: reqSub.id,
          subjectName: reqSub.name,
          code: reqSub.code,
          status: 'PENDING_APPROVAL',
          teacherName: sub.teacher?.name,
          reason: 'Awaiting admin approval',
        });
      } else if (sub.status === 'RETURNED') {
        missingCount++;
        blockers.push(`Subject "${reqSub.name}" was returned for correction: ${sub.rejectionReason || 'Please review.'}`);
        subjectDetails.push({
          subjectId: reqSub.id,
          subjectName: reqSub.name,
          code: reqSub.code,
          status: 'RETURNED',
          teacherName: sub.teacher?.name,
          reason: sub.rejectionReason || 'Returned for correction',
        });
      } else {
        missingCount++;
        blockers.push(`Subject "${reqSub.name}" mark submission is in draft.`);
        subjectDetails.push({
          subjectId: reqSub.id,
          subjectName: reqSub.name,
          code: reqSub.code,
          status: 'MISSING',
          teacherName: sub.teacher?.name,
          reason: 'Submission is in draft mode',
        });
      }
    }

    if (requiredSubjects.length === 0) {
      blockers.push('No required subjects found for this grade and section.');
    } else if (approvedCount === requiredSubjects.length) {
      if (reportCard.averageScore === null || isNaN(reportCard.averageScore)) {
        blockers.push('Report card calculations are invalid (average score is invalid).');
      }
    }

    const isReady = blockers.length === 0 && approvedCount === requiredSubjects.length && requiredSubjects.length > 0;

    return {
      reportCardId,
      studentId: reportCard.studentId,
      studentName: reportCard.student?.fullName,
      studentUniqueId: reportCard.student?.student_id,
      currentStatus: reportCard.status,
      isReady,
      canPublish: isReady,
      blockers,
      summary: {
        totalRequired: requiredSubjects.length,
        approvedCount,
        pendingCount,
        missingCount,
      },
      subjectDetails,
      reportCard,
    };
  }

  /**
   * Publish an individual report card after validating readiness
   */
  async publishReportCard(id: string, publisherId?: string) {
    const validation = await this.validateReportCardReadiness(id);
    if (!validation.isReady) {
      throw new Error(`Cannot publish report card: ${validation.blockers.join('; ')}`);
    }

    const existing = validation.reportCard;
    const now = new Date();
    const isRepublish = !!existing.publishedAt || existing.status === 'PUBLISHED' || existing.status === 'NEEDS_CORRECTION';

    return prisma.reportCard.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: existing.publishedAt || now,
        publishedById: existing.publishedById || publisherId || null,
        republishedAt: isRepublish ? now : undefined,
        republishedById: isRepublish ? (publisherId || null) : undefined,
      },
      include: {
        student: { select: { id: true, student_id: true, fullName: true } },
        grade: true,
        section: true,
        academicYear: true,
        academicTerm: true,
        subjectScores: { include: { subject: true } },
      },
    });
  }

  /**
   * Bulk publish eligible report cards for a grade and section
   * Skips incomplete ones and returns detailed report
   */
  async bulkPublishReportCards(
    params: {
      gradeId: string;
      sectionId: string;
      academicYearId: string;
      academicTermId: string;
      reportCardIds?: string[];
    },
    publisherId?: string
  ) {
    const { gradeId, sectionId, academicYearId, academicTermId, reportCardIds } = params;

    // Refresh calculations
    await this.generateReportCards({ gradeId, sectionId, academicYearId, academicTermId });

    const where: any = {
      gradeId,
      sectionId,
      academicYearId,
      academicTermId,
    };
    if (reportCardIds && reportCardIds.length > 0) {
      where.id = { in: reportCardIds };
    }

    const cards = await prisma.reportCard.findMany({
      where,
      select: { id: true },
    });

    const publishedIds: string[] = [];
    const blocked: Array<{
      studentId: string;
      studentName: string;
      reasons: string[];
    }> = [];

    const now = new Date();

    for (const c of cards) {
      const val = await this.validateReportCardReadiness(c.id);
      if (val.isReady) {
        const isRepublish = !!val.reportCard.publishedAt || val.reportCard.status === 'PUBLISHED' || val.reportCard.status === 'NEEDS_CORRECTION';
        await prisma.reportCard.update({
          where: { id: c.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: val.reportCard.publishedAt || now,
            publishedById: val.reportCard.publishedById || publisherId || null,
            republishedAt: isRepublish ? now : undefined,
            republishedById: isRepublish ? (publisherId || null) : undefined,
          },
        });
        publishedIds.push(c.id);
      } else {
        blocked.push({
          studentId: val.studentId,
          studentName: val.studentName || 'Student',
          reasons: val.blockers,
        });
      }
    }

    return {
      total: cards.length,
      publishedCount: publishedIds.length,
      skippedCount: blocked.length,
      publishedIds,
      blocked,
    };
  }

  /**
   * Class Readiness Overview for Administration Dashboard
   */
  async getClassReadinessOverview(params: {
    gradeId: string;
    sectionId: string;
    academicYearId: string;
    academicTermId?: string;
  }) {
    const { gradeId, sectionId, academicYearId, academicTermId } = params;

    const requiredSubjects = await this.getRequiredSubjectsForGradeAndSection(
      gradeId,
      sectionId,
      academicYearId,
      academicTermId
    );

    const submissionRecords = await prisma.assessmentSubmissionRecord.findMany({
      where: {
        academicYearId,
        ...(academicTermId ? { academicTermId } : {}),
        gradeId,
        sectionId,
      },
      include: {
        subject: true,
        teacher: true,
      },
    });

    const subMap = new Map<string, any>(submissionRecords.map((s) => [s.subjectId, s]));

    const subjectStatusList = requiredSubjects.map((subj) => {
      const sub = subMap.get(subj.id);
      let status: 'APPROVED' | 'PENDING_APPROVAL' | 'RETURNED' | 'MISSING' = 'MISSING';
      if (sub?.status === 'APPROVED') status = 'APPROVED';
      else if (sub?.status === 'SUBMITTED' || sub?.status === 'PENDING_APPROVAL') status = 'PENDING_APPROVAL';
      else if (sub?.status === 'RETURNED') status = 'RETURNED';

      return {
        id: subj.id,
        name: subj.name,
        code: subj.code,
        color: subj.color,
        status,
        submissionId: sub?.id,
        teacherName: sub?.teacher?.name,
        submittedAt: sub?.submittedAt,
        reviewedAt: sub?.reviewedAt,
        rejectionReason: sub?.rejectionReason,
      };
    });

    const approvedCount = subjectStatusList.filter((s) => s.status === 'APPROVED').length;
    const pendingCount = subjectStatusList.filter((s) => s.status === 'PENDING_APPROVAL').length;
    const missingCount = subjectStatusList.filter((s) => s.status === 'MISSING' || s.status === 'RETURNED').length;

    const pendingSubjects = subjectStatusList
      .filter((s) => s.status !== 'APPROVED')
      .map((s) => ({
        subjectId: s.id,
        subjectName: s.name,
        status: s.status,
      }));

    const reportCards = await prisma.reportCard.findMany({
      where: {
        gradeId,
        sectionId,
        academicYearId,
        ...(academicTermId ? { academicTermId } : {}),
      },
      select: { id: true, status: true },
    });

    const totalStudents = await prisma.student.count({
      where: { gradeId, sectionId, status: 'ACTIVE' },
    });

    const draftCount = reportCards.filter((r) => r.status === 'DRAFT').length;
    const readyCount = reportCards.filter((r) => r.status === 'READY').length;
    const publishedCount = reportCards.filter((r) => r.status === 'PUBLISHED').length;
    const needsCorrectionCount = reportCards.filter((r) => r.status === 'NEEDS_CORRECTION').length;

    const isReady = requiredSubjects.length > 0 && approvedCount === requiredSubjects.length;

    return {
      gradeId,
      sectionId,
      academicYearId,
      academicTermId,
      totalStudents,
      isFullyReady: isReady,
      isAllApproved: isReady,
      totalRequiredSubjects: requiredSubjects.length,
      requiredSubjectsCount: requiredSubjects.length,
      approvedSubjectsCount: approvedCount,
      pendingSubjectsCount: pendingCount,
      missingSubjectsCount: missingCount,
      pendingSubjects,
      subjectStatusList,
      reportCardsSummary: {
        total: reportCards.length,
        ready: readyCount,
        draft: draftCount,
        published: publishedCount,
        needsCorrection: needsCorrectionCount,
        draftCount,
        readyCount,
        publishedCount,
        needsCorrectionCount,
      },
    };
  }

  async isReportCardPublished(studentId: string, academicYearId?: string, academicTermId?: string): Promise<boolean> {
    const card = await prisma.reportCard.findFirst({
      where: {
        studentId,
        ...(academicYearId ? { academicYearId } : {}),
        ...(academicTermId ? { academicTermId } : {}),
        status: 'PUBLISHED',
      },
    });
    return !!card;
  }

  async getReportCards(filters: {
    gradeId?: string;
    sectionId?: string;
    streamId?: string;
    academicYearId?: string;
    academicTermId?: string;
    status?: string;
  }) {
    const where: any = {};
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    // When 'annual' or 'all' is selected, omit the term filter so all terms are returned
    if (filters.academicTermId && filters.academicTermId !== 'annual' && filters.academicTermId !== 'all') {
      where.academicTermId = filters.academicTermId;
    }
    if (filters.status) where.status = filters.status;
    if (filters.streamId && filters.streamId !== 'all') {
      where.OR = [
        { section: { streamId: filters.streamId } },
        { student: { streamId: filters.streamId } },
      ];
    }

    return prisma.reportCard.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            student_id: true,
            fullName: true,
            gender: true,
            streamId: true,
            stream: { select: { id: true, name: true } },
          },
        },
        grade: { select: { id: true, name: true } },
        section: {
          select: {
            id: true,
            name: true,
            streamId: true,
            stream: { select: { id: true, name: true } },
          },
        },
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
    // Only published report cards are visible to students and parents
    const where: any = {
      studentId,
      status: 'PUBLISHED',
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
   * Get dynamic, comprehensive report card data matching Bright Path official layout
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
        section: { include: { stream: true } },
        stream: true,
        academicRecords: {
          include: {
            grade: true,
            section: { include: { stream: true } },
            stream: true,
          },
          orderBy: { enrolledAt: 'desc' },
        },
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

    // If not explicitly passed, check if student has existing report cards
    if (!targetYear) {
      const existingRc = await prisma.reportCard.findFirst({
        where: { studentId: student.id },
        include: { academicYear: { include: { terms: { orderBy: { startDate: 'asc' } } } } },
        orderBy: { createdAt: 'desc' },
      });
      if (existingRc?.academicYear) {
        targetYear = existingRc.academicYear;
      }
    }

    // Next check academic records
    if (!targetYear && student.academicRecords.length > 0) {
      const recordYearId = student.academicRecords[0].academicYearId;
      targetYear = await prisma.academicYear.findUnique({
        where: { id: recordYearId },
        include: { terms: { orderBy: { startDate: 'asc' } } },
      });
    }

    // Default to current year only if no prior records exist
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

    // Fetch existing report cards for student for the resolved target year
    const reportCards = await prisma.reportCard.findMany({
      where: {
        studentId: student.id,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
      },
      include: {
        academicTerm: true,
        grade: true,
        section: { include: { stream: true } },
        subjectScores: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve Academic Term
    const isSingleTerm = !!(academicTermId && academicTermId !== 'all' && academicTermId !== 'annual');
    let effectiveTermId = academicTermId || 'annual';
    let effectiveTermName = 'Annual';

    if (isSingleTerm) {
      const termObj = targetYear?.terms?.find((t) =>
        t.id === academicTermId ||
        (academicTermId === 'sem1' && (t.name.toLowerCase().includes('1') || t.name.toLowerCase().includes('first'))) ||
        (academicTermId === 'sem2' && (t.name.toLowerCase().includes('2') || t.name.toLowerCase().includes('second')))
      );
      effectiveTermId = termObj?.id || academicTermId!;
      effectiveTermName = termObj?.name || (academicTermId === 'sem1' ? 'Semester 1' : academicTermId === 'sem2' ? 'Semester 2' : 'Semester');
    } else if (reportCards.length === 1 && !academicTermId) {
      effectiveTermId = reportCards[0].academicTermId;
      effectiveTermName = reportCards[0].academicTerm?.name || 'Semester';
    }

    // Historical Enrollment Resolution: Grade, Section & Stream
    const termSpecificRc = isSingleTerm
      ? reportCards.find((rc) => rc.academicTermId === academicTermId)
      : null;
    const latestRc = termSpecificRc || reportCards[0];

    const historicalRecord = student.academicRecords.find((r) => r.academicYearId === targetYear?.id);
    const effectiveGrade = latestRc?.grade || historicalRecord?.grade || student.grade;
    const effectiveSection = latestRc?.section || historicalRecord?.section || student.section;

    // Check if Grade 11 or 12
    const isGrade11or12 = /\b(11|12)\b/.test(effectiveGrade?.name || '');

    // Resolve Stream for Grade 11 & 12
    let effectiveStreamId: string | null = null;
    let effectiveStreamName: string | null = null;

    if (isGrade11or12) {
      const rawStream = historicalRecord?.stream || student.stream || effectiveSection?.stream;
      effectiveStreamId = historicalRecord?.streamId || student.streamId || effectiveSection?.streamId || null;

      if (!rawStream && effectiveStreamId) {
        const streamInDb = await prisma.stream.findUnique({ where: { id: effectiveStreamId } });
        if (streamInDb) {
          const sName = streamInDb.name;
          effectiveStreamName = sName.toLowerCase().includes('natural')
            ? 'Natural Science'
            : sName.toLowerCase().includes('social')
            ? 'Social Science'
            : sName;
        }
      } else if (rawStream) {
        const sName = rawStream.name;
        effectiveStreamName = sName.toLowerCase().includes('natural')
          ? 'Natural Science'
          : sName.toLowerCase().includes('social')
          ? 'Social Science'
          : sName;
      }
    }

    // Resolve Homeroom Teacher
    const homeroomAssignment = await prisma.teacherAssignment.findFirst({
      where: {
        gradeId: effectiveGrade.id,
        sectionId: effectiveSection.id,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
        role: 'HOMEROOM_TEACHER',
      },
      include: { teacher: true },
    });

    let homeroomTeacherName = homeroomAssignment?.teacher?.name;
    if (!homeroomTeacherName) {
      const anyAssignment = await prisma.teacherAssignment.findFirst({
        where: {
          gradeId: effectiveGrade.id,
          sectionId: effectiveSection.id,
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

    const sortedSubjects = [...allSubjects].sort((a, b) => a.name.localeCompare(b.name));

    // Fetch assessments & marks for student
    const assessments = await prisma.assessment.findMany({
      where: {
        gradeId: effectiveGrade.id,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
        OR: [{ sectionId: null }, { sectionId: effectiveSection.id }],
      },
      include: {
        marks: { where: { studentId: student.id } },
        subject: true,
        academicTerm: true,
        category: true,
        assessmentType: true,
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

    // Conduct & Remarks
    const conduct = latestRc?.conduct || 'A-';
    const teacherComment = latestRc?.homeroomTeacherComment || '';
    const principalComment = latestRc?.principalComment || '';

    // Curriculum & Stream-specific Subjects Filtering
    let streamGradeSubjects: Array<{ subjectId: string }> = [];
    if (isGrade11or12) {
      streamGradeSubjects = await prisma.gradeSubject.findMany({
        where: {
          gradeId: effectiveGrade.id,
          ...(effectiveStreamId ? { streamId: effectiveStreamId } : {}),
        },
        select: { subjectId: true },
      });
    }

    const teacherAssignedSubjectIds = await prisma.teacherAssignment.findMany({
      where: {
        gradeId: effectiveGrade.id,
        ...(targetYear ? { academicYearId: targetYear.id } : {}),
      },
      select: { subjectId: true },
    }).then((records) => records.map((r) => r.subjectId).filter(Boolean) as string[]);

    const assessedSubjectIds = assessments.map((a) => a.subjectId).filter(Boolean);
    const scoredSubjectIds = reportCards.flatMap((rc) => rc.subjectScores.map((ss) => ss.subjectId)).filter(Boolean);

    const relevantSubjectIdSet = new Set([
      ...teacherAssignedSubjectIds,
      ...assessedSubjectIds,
      ...scoredSubjectIds,
      ...streamGradeSubjects.map((gs) => gs.subjectId),
    ]);

    const isNaturalStream = effectiveStreamName?.toLowerCase().includes('natural');
    const isSocialStream = effectiveStreamName?.toLowerCase().includes('social');

    const activeSubjects = sortedSubjects.filter((subj) => {
      // 1. If explicit GradeSubject records exist for Grade 11/12 with this stream, use them strictly
      if (isGrade11or12 && streamGradeSubjects.length > 0) {
        return streamGradeSubjects.some((gs) => gs.subjectId === subj.id);
      }

      // 2. Otherwise apply stream track rules for Grades 11 and 12
      if (isGrade11or12) {
        const subjName = subj.name.toLowerCase();
        if (isNaturalStream && (subjName.includes('history') || subjName.includes('geography') || subjName.includes('economics'))) {
          return false;
        }
        if (isSocialStream && (subjName.includes('physics') || subjName.includes('chemistry') || subjName.includes('biology'))) {
          return false;
        }
      }

      // 3. Keep subjects that are taught or assessed
      if (relevantSubjectIdSet.size > 0) {
        return relevantSubjectIdSet.has(subj.id);
      }
      return true;
    });

    // Helper to compute weighted score for an assessment collection
    // Distinguishes missing marks from a valid score of 0:
    // - If any required assessment mark is missing/unentered, returns null (incomplete)
    // - If score is 0 or student is marked absent, counts as 0 (valid recorded mark)
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
        const hasValidRecordedScore = mark && (mark.score !== null && mark.score !== undefined);
        const isAbsent = mark?.isAbsent || mark?.status === 'ABSENT';
        const isExcused = mark?.status === 'EXCUSED';

        if (isExcused) {
          // Excused assessment is omitted from calculation
          continue;
        }

        // CRITICAL: If an assessment mark was not entered (missing),
        // we must NOT assume 0 and must NOT calculate provisional total as complete!
        // Return null to signify incomplete marks for this assessment set.
        if (!hasValidRecordedScore && !isAbsent) {
          return null;
        }

        hasGradedMark = true;
        // 0 is a valid score!
        const rawScore = isAbsent ? 0 : Number(mark!.score);
        const max = ass.maxScore > 0 ? ass.maxScore : 100;
        const pct = (rawScore / max) * 100;
        const weight = ass.weightage > 0 ? ass.weightage : 100;

        weightedSum += (pct * weight) / 100;
        totalWeight += weight;
      }

      if (!hasGradedMark || totalWeight === 0) return null;
      return Math.round(((weightedSum / totalWeight) * 100) * 10) / 10;
    };

    // 1. Resolve school grading policy from database
    const gradingScales = await this.getGradingScales();
    const passingScales = gradingScales.filter((s) => s.isPassing);
    const failingScales = gradingScales.filter((s) => !s.isPassing);

    // Dynamic passing benchmark derived directly from the school's active grading policy
    const policyPassingMinScore = passingScales.length > 0
      ? Math.min(...passingScales.map((s) => s.minScore))
      : (failingScales.length > 0 ? Math.max(...failingScales.map((s) => s.maxScore)) : 50.0);

    const findGradeLetter = (pct: number) => {
      for (const scale of gradingScales) {
        if (pct >= scale.minScore && (pct <= scale.maxScore || scale.maxScore >= 100)) {
          return {
            letter: scale.grade,
            gpa: scale.gpaPoint ?? 0,
            isPassing: scale.isPassing,
            description: scale.description,
          };
        }
      }
      // If outside configured scale boundaries, determine passing status via policy benchmark
      const isPass = pct >= policyPassingMinScore;
      const fallbackScale = isPass
        ? (passingScales[passingScales.length - 1] || gradingScales[0])
        : (failingScales[0] || gradingScales[gradingScales.length - 1]);
      return {
        letter: fallbackScale?.grade || (isPass ? 'D' : 'F'),
        gpa: fallbackScale?.gpaPoint ?? (isPass ? 1.0 : 0.0),
        isPassing: fallbackScale ? fallbackScale.isPassing : isPass,
        description: fallbackScale?.description || (isPass ? 'Passing' : 'Failing'),
      };
    };

    // Resolve active assessment policy scheme to check if Midterms are configured
    const activeScheme = await AssessmentPolicyService.resolveSchemeForContext({
      academicYearId: targetYear?.id || '',
      academicTermId: isSingleTerm ? effectiveTermId : undefined,
      gradeId: effectiveGrade.id,
      streamId: effectiveStreamId || undefined,
    }).catch(() => null);

    const schemeHasMidterm = (activeScheme?.categories || []).some((c: any) => {
      const cName = (c.name || '').toLowerCase();
      const tCode = (c.type?.code || '').toUpperCase();
      return tCode === 'MIDTERM' || cName.includes('midterm') || cName.includes('mid');
    });

    const isMidtermAssessment = (a: any) => {
      const type = (a.type || '').toUpperCase();
      const typeCode = (a.assessmentType?.code || '').toUpperCase();
      const catName = (a.category?.name || '').toLowerCase();
      const title = (a.title || '').toLowerCase();
      return (
        type === 'MIDTERM' ||
        typeCode === 'MIDTERM' ||
        catName.includes('midterm') ||
        catName.includes('mid') ||
        title.includes('midterm') ||
        title.includes('1st mid') ||
        title.includes('mid 1') ||
        title.includes('2nd mid') ||
        title.includes('mid 2')
      );
    };

    const hasTerm1Midterm = schemeHasMidterm || assessments.some((a) => {
      const tName = (a.academicTerm?.name || '').toLowerCase();
      const isTerm1 = tName.includes('1') || tName.includes('first') || (!tName.includes('2') && !tName.includes('second'));
      return isTerm1 && isMidtermAssessment(a);
    });

    const hasTerm2Midterm = schemeHasMidterm || assessments.some((a) => {
      const tName = (a.academicTerm?.name || '').toLowerCase();
      const isTerm2 = tName.includes('2') || tName.includes('second');
      return isTerm2 && isMidtermAssessment(a);
    });

    // Determine periods (columns) dynamically based on active term and whether midterms are configured/assessed
    let periods: Array<{ id: string; label: string }> = [];

    const termNameLower = effectiveTermName.toLowerCase();
    if (termNameLower.includes('2') || termNameLower.includes('second')) {
      if (hasTerm2Midterm) {
        periods.push({ id: 'mid2', label: '2nd Mid' });
      }
      periods.push({ id: 'sem2', label: '2nd Semester' });
    } else if (termNameLower.includes('1') || termNameLower.includes('first')) {
      if (hasTerm1Midterm) {
        periods.push({ id: 'mid1', label: '1st Mid' });
      }
      periods.push({ id: 'sem1', label: '1st Semester' });
    } else {
      // Annual / All terms
      if (hasTerm1Midterm) {
        periods.push({ id: 'mid1', label: '1st Mid' });
      }
      periods.push({ id: 'sem1', label: '1st Semester' });

      if (hasTerm2Midterm) {
        periods.push({ id: 'mid2', label: '2nd Mid' });
      }
      periods.push({ id: 'sem2', label: '2nd Semester' });
    }

    const rawSubjectScoresList = activeSubjects.map((subj) => {
      const scores: Record<string, number | null> = {};
      const subjAssessments = assessments.filter((a) => a.subjectId === subj.id);

      periods.forEach((period) => {
        // 1. Find matching assessments for this specific period
        const matchingAssessments = subjAssessments.filter((a) => {
          const tName = (a.academicTerm?.name || '').toLowerCase();

          const isTerm1 = tName.includes('1') || tName.includes('first') || (!tName.includes('2') && !tName.includes('second'));
          const isTerm2 = tName.includes('2') || tName.includes('second');

          const isMid = isMidtermAssessment(a);

          if (period.id === 'mid1') {
            if (!isTerm1) return false;
            return isMid;
          }
          if (period.id === 'sem1') {
            if (!isTerm1) return false;
            if (hasTerm1Midterm) {
              return !isMid;
            }
            return true;
          }
          if (period.id === 'mid2') {
            if (!isTerm2) return false;
            return isMid;
          }
          if (period.id === 'sem2') {
            if (!isTerm2) return false;
            if (hasTerm2Midterm) {
              return !isMid;
            }
            return true;
          }
          return false;
        });

        let score: number | null = computeWeightedScore(matchingAssessments, student.id);

        // 2. If sem1/sem2 has no specific final assessment, calculate weighted score across all assessments in that term
        if (score === null && (period.id === 'sem1' || period.id === 'sem2')) {
          const termAssessments = subjAssessments.filter((a) => {
            const tName = (a.academicTerm?.name || '').toLowerCase();
            return period.id === 'sem1'
              ? (tName.includes('1') || tName.includes('first') || (!tName.includes('2') && !tName.includes('second')))
              : (tName.includes('2') || tName.includes('second'));
          });
          score = computeWeightedScore(termAssessments, student.id);
        }

        // 3. Fallback to saved official report card subject score (ONLY for semester periods, NEVER for midterm!)
        if (score === null && (period.id === 'sem1' || period.id === 'sem2')) {
          const rcMatch = reportCards.find((rc) => {
            const tName = (rc.academicTerm?.name || '').toLowerCase();
            if (period.id === 'sem1' && (tName.includes('1') || tName.includes('first'))) return true;
            if (period.id === 'sem2' && (tName.includes('2') || tName.includes('second'))) return true;
            return false;
          });
          const subjScoreMatch = rcMatch?.subjectScores.find((ss) => ss.subjectId === subj.id);
          if (subjScoreMatch && subjScoreMatch.score !== undefined && subjScoreMatch.score !== null) {
            score = Math.round(subjScoreMatch.score * 10) / 10;
          }
        }

        scores[period.id] = score;
      });

      return {
        subjectId: subj.id,
        subjectName: subj.name,
        code: subj.code,
        scores,
      };
    });

    const isSingleTermEval = effectiveTermName !== 'Annual';

    // Authoritative Promotion & Pass/Fail Evaluation:
    // - Incomplete: If any required assessment or term mark is missing, displays INCOMPLETE and denies passing/promotion.
    // - Zero (0): Treated as valid recorded score, calculated normally with existing grading/promotion rules.
    // - Complete: Only determines PASS/FAIL/PROMOTION when all required marks are recorded.
    const promoEval = evaluateStudentPromotion({
      subjectScores: rawSubjectScoresList,
      requiredPeriodIds: periods.map((p) => p.id),
      isSingleTerm: isSingleTermEval,
      policyPassingMinScore,
      gradingScales,
    });

    const subjectRows = promoEval.subjectRows.map((r) => ({
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      code: r.code,
      weight: 100,
      scores: r.scores as Record<string, number>,
      total: r.total ?? 0,
      average: r.average ?? 0,
      isPassing: r.isPassing,
      gradeLetter: r.gradeLetter,
      isComplete: r.isComplete,
      missingPeriods: r.missingPeriods,
    }));

    // Column Totals
    const columnTotals: Record<string, number> = {};
    const columnAverages: Record<string, number> = {};

    periods.forEach((p) => {
      const validScores = subjectRows
        .map((r) => r.scores[p.id])
        .filter((s): s is number => s !== null && s !== undefined);

      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, curr) => acc + curr, 0);
        columnTotals[p.id] = Math.round(sum * 10) / 10;
        columnAverages[p.id] = Math.round((sum / validScores.length) * 10) / 10;
      } else {
        columnTotals[p.id] = null as any;
        columnAverages[p.id] = null as any;
      }
    });

    const totalPointsSum = promoEval.totalPointsSum ?? Math.round(subjectRows.reduce((acc, row) => acc + (row.total || 0), 0) * 10) / 10;
    const overallAverage = promoEval.overallAverage ?? (subjectRows.length > 0 ? Math.round((subjectRows.reduce((acc, row) => acc + (row.average || 0), 0) / subjectRows.length) * 10) / 10 : 0);

    columnTotals['total'] = totalPointsSum;
    columnTotals['average'] = overallAverage;
    columnAverages['overall'] = overallAverage;

    // Class Standing & Section Size
    const sectionStudentsCount = await prisma.student.count({
      where: {
        gradeId: effectiveGrade.id,
        sectionId: effectiveSection.id,
        status: 'ACTIVE',
      },
    });

    const totalStudentsInClass = sectionStudentsCount > 0 ? sectionStudentsCount : 1;
    let studentRank = latestRc?.rank || 1;

    // For Full Academic Year / Annual evaluation, calculate rank by annual average across the class section
    if (effectiveTermName === 'Annual' && targetYear?.id) {
      try {
        const classReportCards = await prisma.reportCard.findMany({
          where: {
            gradeId: effectiveGrade.id,
            sectionId: effectiveSection.id,
            academicYearId: targetYear.id,
          },
          select: {
            studentId: true,
            averageScore: true,
          },
        });

        if (classReportCards.length > 0) {
          const studentAverages = new Map<string, number[]>();
          for (const rc of classReportCards) {
            if (typeof rc.averageScore === 'number' && !isNaN(rc.averageScore)) {
              const list = studentAverages.get(rc.studentId) || [];
              list.push(rc.averageScore);
              studentAverages.set(rc.studentId, list);
            }
          }

          const studentAnnualAvgList: { studentId: string; avg: number }[] = [];
          for (const [sId, avgs] of studentAverages.entries()) {
            const annualAvg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
            studentAnnualAvgList.push({ studentId: sId, avg: annualAvg });
          }

          studentAnnualAvgList.sort((a, b) => b.avg - a.avg);
          const foundIdx = studentAnnualAvgList.findIndex((item) => item.studentId === student.id);
          if (foundIdx !== -1) {
            studentRank = foundIdx + 1;
          }
        }
      } catch (err) {
        // Fallback to latestRc rank
      }
    }

    const rankDisplay = promoEval.isIncomplete ? '—' : `${studentRank}/${totalStudentsInClass}`;

    // Official Report Card ID & Issue Date
    const yearSuffix = targetYear?.name ? targetYear.name.replace(/[^\w]/g, '') : '2018';
    const reportCardId = latestRc?.id
      ? `BP-RC-${latestRc.id.substring(0, 8).toUpperCase()}`
      : `BP-RC-${student.student_id}-${yearSuffix}`;

    const issueDate = latestRc?.publishedAt
      ? new Date(latestRc.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : latestRc?.createdAt
      ? new Date(latestRc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Verifiable QR Code payload (direct URL for mobile camera scanning)
    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const targetRcId = latestRc?.id || student.id;
    const qrVerificationPayload = `${appBaseUrl.replace(/\/$/, '')}/verify/report-card?id=${targetRcId}`;

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
        gradeId: effectiveGrade.id,
        gradeName: effectiveGrade.name,
        sectionId: effectiveSection.id,
        sectionName: effectiveSection.name,
        streamId: effectiveStreamId,
        streamName: effectiveStreamName,
        academicYearId: targetYear?.id || '',
        academicYearName: targetYear?.name || '',
        academicTermId: effectiveTermId,
        academicTermName: effectiveTermName,
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
        remarkBadge: promoEval.remarkBadge,
        isPassing: promoEval.isOverallPassing,
        canPromote: promoEval.canPromote,
        isIncomplete: promoEval.isIncomplete,
        missingReasons: promoEval.missingReasons,
        failedSubjectsCount: promoEval.failedSubjectsCount,
        passingMinScore: policyPassingMinScore,
        teacherComment,
        principalComment,
      },
      gradingPolicy: {
        passingMinScore: policyPassingMinScore,
        scales: gradingScales.map((s) => ({
          grade: s.grade,
          minScore: s.minScore,
          maxScore: s.maxScore,
          gpaPoint: s.gpaPoint,
          description: s.description,
          color: s.color,
          isPassing: s.isPassing,
        })),
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

    // Ensure rankings are correctly assigned across the class section
    const totalStudents = results.length;
    const isAnnualBatch = !academicTermId || academicTermId === 'annual' || academicTermId === 'all';

    if (isAnnualBatch && totalStudents > 0) {
      // For Full Academic Year, rank students by annual overallAverage in descending order
      const sortedCards = [...results].sort(
        (a, b) => (b.summary.averageRow.overallAverage || 0) - (a.summary.averageRow.overallAverage || 0)
      );
      sortedCards.forEach((card, index) => {
        const rankStr = `${index + 1}/${totalStudents}`;
        card.summary.rank = rankStr;
      });
    } else {
      const needsBatchRank = results.length > 1 && results.every(
        (c) => !c.summary.rank || c.summary.rank === '1/1' || c.summary.rank === `1/${totalStudents}`
      );

      if (needsBatchRank && totalStudents > 1) {
        // Sort copy descending by overallAverage
        const sortedCards = [...results].sort(
          (a, b) => (b.summary.averageRow.overallAverage || 0) - (a.summary.averageRow.overallAverage || 0)
        );
        sortedCards.forEach((card, index) => {
          const rankStr = `${index + 1}/${totalStudents}`;
          card.summary.rank = rankStr;
        });
      }
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

    const termValidation = await academicYearService.validateMarkEntryWindow(academicTermId, academicYearId);

    // Resolve subject if subjectId was passed as a name or code
    let resolvedSubjectId = subjectId;
    const subjectRecord = await prisma.subject.findFirst({
      where: {
        OR: [
          { id: subjectId },
          { name: { equals: subjectId, mode: 'insensitive' as const } },
          { code: { equals: subjectId, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true, name: true, code: true },
    });
    if (subjectRecord) {
      resolvedSubjectId = subjectRecord.id;
    }

    // 1. Resolve Assessment Policy Scheme
    const scheme = await AssessmentPolicyService.resolveSchemeForContext({
      academicYearId,
      academicTermId,
      gradeId,
      subjectId: resolvedSubjectId,
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
        subjectId: resolvedSubjectId,
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
        subjectId: resolvedSubjectId,
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
    });

    // Fetch the assigned teacher for this class & subject
    const assignmentRecord = await prisma.teacherAssignment.findFirst({
      where: {
        gradeId,
        ...(sectionId ? { sectionId } : {}),
        OR: [
          { subjectId: resolvedSubjectId },
          { subject: subjectRecord?.name || subjectId },
        ],
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
      assignedTeacher: assignmentRecord?.teacher || null,
      subject: subjectRecord || { id: resolvedSubjectId, name: subjectId, code: subjectId },
      termStatus: {
        activeTermId: termValidation.activeTerm?.id || null,
        activeTermName: termValidation.activeTerm?.name || null,
        activeTermStartDate: termValidation.activeTerm?.startDate || null,
        activeTermEndDate: termValidation.activeTerm?.endDate || null,
        isMarkEntryAllowed: termValidation.allowed,
        lockCode: termValidation.code || null,
        lockReason: termValidation.message || null,
      },
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
      status?: string;
      remarks?: string;
    }>;
    gradedById?: string;
  }) {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, marks, gradedById } = params;

    const termValidation = await academicYearService.validateMarkEntryWindow(academicTermId, academicYearId);
    if (!termValidation.allowed) {
      const err: any = new Error(termValidation.message || 'Mark entry is not permitted for this term');
      err.status = 403;
      err.code = termValidation.code;
      throw err;
    }

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

    if (!marks || marks.length === 0) {
      return {
        count: 0,
        updatedCount: 0,
        success: true,
      };
    }

    // Load assessments to validate maxScore
    const assessmentIds = Array.from(new Set(marks.map((m) => m.assessmentId)));
    const assessments = await prisma.assessment.findMany({
      where: { id: { in: assessmentIds } },
    });
    const assessmentMap = new Map(assessments.map((a) => [a.id, a]));

    const operations: any[] = [];
    for (const item of marks) {
      const assess = assessmentMap.get(item.assessmentId);
      if (!assess) continue;

      let score = item.score;
      if (item.isAbsent) {
        score = 0;
      } else if (score !== null && score !== undefined) {
        score = Math.min(Math.max(Number(score), 0), assess.maxScore);
      }

      const status = item.status || (item.isAbsent ? 'ABSENT' : score !== null && score !== undefined ? 'PRESENT' : 'UNGRADED');

      operations.push(
        prisma.studentMark.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: item.assessmentId,
              studentId: item.studentId,
            },
          },
          update: {
            score,
            isAbsent: !!item.isAbsent,
            status,
            remarks: item.remarks || null,
            gradedById: gradedById || null,
          },
          create: {
            assessmentId: item.assessmentId,
            studentId: item.studentId,
            score,
            isAbsent: !!item.isAbsent,
            status,
            remarks: item.remarks || null,
            gradedById: gradedById || null,
          },
        })
      );
    }

    // Execute in batch transactions of 50 to avoid interactive transaction timeouts and handle connection pooling gracefully
    const BATCH_SIZE = 50;
    const results: any[] = [];
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const chunkResults = await prisma.$transaction(chunk);
      results.push(...chunkResults);
    }

    // If submission record does not exist, create it as DRAFT
    if (!submission && academicTermId) {
      try {
        let teacherId = gradedById;
        if (gradedById) {
          const user = await prisma.user.findUnique({
            where: { id: gradedById },
            select: { teacher_id: true },
          });
          if (user?.teacher_id) teacherId = user.teacher_id;
        }

        if (teacherId) {
          await prisma.assessmentSubmissionRecord.upsert({
            where: {
              academicYearId_academicTermId_gradeId_sectionId_subjectId: {
                academicYearId,
                academicTermId,
                gradeId,
                sectionId,
                subjectId,
              },
            },
            update: {},
            create: {
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
      } catch (submissionErr) {
        console.warn('[GradebookService] Auto-create draft submission record warning:', submissionErr);
      }
    }

    return {
      count: results.length,
      updatedCount: results.length,
      success: true,
    };
  }

  /**
   * Public verification of an official report card by ReportCard ID or Student ID
   */
  async verifyReportCard(id: string) {
    if (!id || id.trim() === '') {
      throw new Error('Verification identifier is required');
    }

    const cleanId = id.trim();
    // Support prefixes like "BP-RC-12345678", "AH-RC-12345678" or "BP-RC-STU-001-2018"
    const strippedId = cleanId.replace(/^(BP|AH)-RC-/i, '').replace(/-\d{4}$/, '');

    const candidateIds = Array.from(new Set([cleanId, strippedId])).filter(Boolean);

    // 1. Try finding an official persisted ReportCard record
    const reportCard = await prisma.reportCard.findFirst({
      where: {
        OR: candidateIds.flatMap((cid) => [
          { id: cid },
          { id: { startsWith: cid, mode: 'insensitive' as const } },
          { studentId: cid },
          { student: { student_id: cid } },
          { student: { student_id: { equals: cid, mode: 'insensitive' as const } } },
        ]),
      },
      include: {
        student: {
          include: {
            stream: true,
            user: { select: { profile_photo: true } },
          },
        },
        grade: true,
        section: { include: { stream: true } },
        academicYear: true,
        academicTerm: true,
        subjectScores: {
          include: { subject: true },
          orderBy: { score: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const settings = await prisma.schoolSettings.findUnique({ where: { id: 'singleton' } });
    const school = {
      name: settings?.school_name || 'Bright Path School',
      amharicName: 'ብራይት ፓዝ ት/ቤት',
      address: settings?.school_address || 'Dire Dawa',
      phone: settings?.school_phone || '0251 - 11 41 87 / 1838',
      logo: settings?.school_logo || '/bright-path-logo.png',
    };

    if (reportCard) {
      const issueDate = reportCard.publishedAt
        ? new Date(reportCard.publishedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date(reportCard.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      const totalStudentsInClass = await prisma.student.count({
        where: { gradeId: reportCard.gradeId, sectionId: reportCard.sectionId, status: 'ACTIVE' },
      });

      const rankDisplay = reportCard.rank ? `${reportCard.rank} of ${totalStudentsInClass}` : '—';

      // School Grading & Promotion Policy Pass/Fail Logic:
      const gradingScales = await this.getGradingScales();
      const passingScales = gradingScales.filter((s) => s.isPassing);
      const policyPassingMinScore = passingScales.length > 0
        ? Math.min(...passingScales.map((s) => s.minScore))
        : 50.0;

      const hasMissingSubject = reportCard.subjectScores.some((s) => s.status === 'MISSING' || s.score === null);
      const failingSubjects = reportCard.subjectScores.filter((s) => {
        const val = s.score ?? 0;
        const matched = gradingScales.find((sc) => val >= sc.minScore && (val <= sc.maxScore || sc.maxScore >= 100));
        return matched ? !matched.isPassing : val < policyPassingMinScore;
      });
      const isRetained = reportCard.averageScore < policyPassingMinScore || failingSubjects.length >= 3;
      const isConditional = !isRetained && failingSubjects.length > 0;
      let remarkBadge = 'PASSED';
      let isPassing = true;

      if (reportCard.status === 'INCOMPLETE' || hasMissingSubject) {
        remarkBadge = 'INCOMPLETE';
        isPassing = false;
      } else if (isRetained) {
        remarkBadge = 'RETAINED';
        isPassing = false;
      } else if (isConditional) {
        remarkBadge = 'PASSED (CONDITIONAL)';
        isPassing = true;
      } else {
        remarkBadge = 'PASSED';
        isPassing = true;
      }

      const isGrade11or12 = /\b(11|12)\b/.test(reportCard.grade?.name || '');
      let streamName: string | null = null;
      if (isGrade11or12) {
        const raw = reportCard.section?.stream?.name || reportCard.student?.stream?.name;
        if (raw) {
          streamName = raw.toLowerCase().includes('natural')
            ? 'Natural Science'
            : raw.toLowerCase().includes('social')
            ? 'Social Science'
            : raw;
        }
      }

      return {
        verified: true,
        status: reportCard.status,
        isOfficial: reportCard.status === 'PUBLISHED',
        reportCardId: `BP-RC-${reportCard.id.substring(0, 8).toUpperCase()}`,
        certificateId: reportCard.id,
        issueDate,
        school,
        student: {
          id: reportCard.student.id,
          studentId: reportCard.student.student_id,
          fullName: reportCard.student.fullName,
          gender: reportCard.student.gender || 'M',
          photo: reportCard.student.user?.profile_photo || null,
        },
        academic: {
          gradeName: reportCard.grade?.name || '10',
          sectionName: reportCard.section?.name || 'A',
          streamName,
          academicYearName: reportCard.academicYear?.name || '2018 E.C.',
          termName: reportCard.academicTerm?.name || 'Annual',
        },
        performance: {
          totalScore: reportCard.totalScore,
          maxPossibleScore: reportCard.maxPossibleScore,
          averageScore: reportCard.averageScore,
          gpa: reportCard.gpa,
          rank: rankDisplay,
          conduct: reportCard.conduct || 'A',
          remarkBadge,
          teacherComment: reportCard.homeroomTeacherComment,
          principalComment: reportCard.principalComment,
        },
        subjects: reportCard.subjectScores.map((ss) => {
          const val = ss.score ?? 0;
          const matched = gradingScales.find((sc) => val >= sc.minScore && (val <= sc.maxScore || sc.maxScore >= 100));
          const isPassing = matched ? matched.isPassing : val >= policyPassingMinScore;
          return {
            id: ss.subjectId,
            name: ss.subject?.name || 'Subject',
            code: ss.subject?.code,
            score: ss.score,
            maxScore: ss.maxScore || 100,
            gradeLetter: ss.gradeLetter || matched?.grade || (isPassing ? 'D' : 'F'),
            gpaPoint: ss.gpaPoint !== null && ss.gpaPoint !== undefined ? ss.gpaPoint : (matched?.gpaPoint ?? (isPassing ? 1.0 : 0.0)),
            isPassing,
          };
        }),
      };
    }

    // 2. If no persisted report_cards row exists yet, check if student exists
    // and verify dynamically against current official gradebook assessments!
    const student = await prisma.student.findFirst({
      where: {
        OR: candidateIds.flatMap((cid) => [
          { id: cid },
          { student_id: cid },
          { student_id: { equals: cid, mode: 'insensitive' as const } },
        ]),
      },
      include: {
        grade: true,
        section: true,
        user: { select: { profile_photo: true } },
      },
    });

    if (!student) {
      return null;
    }

    const comp = await this.getComprehensiveReportCardData({ studentId: student.id });
    if (!comp) {
      return null;
    }

    return {
      verified: true,
      status: comp.status || 'VERIFIED',
      isOfficial: comp.status === 'PUBLISHED',
      reportCardId: comp.reportCardId || `BP-RC-${student.student_id}-2018`,
      certificateId: `CERT-${student.student_id}-${student.id.substring(0, 8).toUpperCase()}`,
      issueDate: comp.issueDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      school: comp.school || school,
      student: {
        id: student.id,
        studentId: student.student_id,
        fullName: student.fullName,
        gender: student.gender || 'M',
        photo: student.user?.profile_photo || null,
      },
      academic: {
        gradeName: comp.academic?.gradeName || student.grade?.name || '10',
        sectionName: comp.academic?.sectionName || student.section?.name || 'A',
        streamName: comp.academic?.streamName || null,
        academicYearName: comp.academic?.academicYearName || '2018 E.C.',
        termName: comp.academic?.academicTermName || 'Annual',
      },
      performance: {
        totalScore: comp.summary?.totalRow?.total || 0,
        maxPossibleScore: comp.summary?.totalRow?.weight || 0,
        averageScore: comp.summary?.totalRow?.average || 0,
        gpa: comp.summary?.averageRow?.overallAverage ? Number((comp.summary.averageRow.overallAverage / 25).toFixed(2)) : 0,
        rank: comp.summary?.rank || '1',
        conduct: comp.summary?.conduct || 'A',
        remarkBadge: comp.summary?.remarkBadge || 'Passed',
        teacherComment: comp.summary?.teacherComment,
        principalComment: comp.summary?.principalComment,
      },
      subjects: (comp.subjectRows || []).map((row: any) => ({
        id: row.subjectId || row.subjectName,
        name: row.subjectName,
        code: row.code || row.subjectCode,
        score: row.average ?? (row.periodScores?.sem2 ?? row.periodScores?.sem1 ?? 0),
        maxScore: 100,
        gradeLetter: row.gradeLetter || (row.isPassing ? 'D' : 'F'),
        gpaPoint: row.gpaPoint || (row.isPassing ? 1.0 : 0.0),
        isPassing: row.isPassing,
      })),
    };
  }
}

export const gradebookService = new GradebookService();
