import prisma from '../config/db';

// ─── Homework / Assignment Service ──────────────────────────────────────────

export interface HomeworkInput {
  title: string;
  description?: string;
  subjectId: string;
  teacherId?: string;
  gradeId: string;
  sectionId?: string;
  dueDate: string | Date;
  maxScore?: number;
  attachments?: any;
  status?: string;
}

export interface SubmissionInput {
  submissionText?: string;
  attachments?: any;
}

export class HomeworkService {
  // ── Homework CRUD ──────────────────────────────────────────────────────────

  async getHomework(filters: {
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
  }) {
    const where: any = {};
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.teacherId) where.teacherId = filters.teacherId;
    if (filters.status) where.status = filters.status;

    return prisma.assignment.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        teacher: { select: { id: true, name: true, profile_photo: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getHomeworkById(id: string) {
    return prisma.assignment.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        teacher: { select: { id: true, name: true, profile_photo: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        submissions: {
          include: {
            student: { select: { id: true, fullName: true, student_id: true } },
          },
          orderBy: { submittedAt: 'desc' },
        },
        _count: { select: { submissions: true } },
      },
    });
  }

  async createHomework(data: HomeworkInput) {
    return prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        subjectId: data.subjectId,
        teacherId: data.teacherId || null,
        gradeId: data.gradeId,
        sectionId: data.sectionId || null,
        dueDate: new Date(data.dueDate),
        maxScore: data.maxScore ?? 100,
        attachments: data.attachments || null,
        status: data.status || 'PUBLISHED',
      },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
  }

  async updateHomework(id: string, data: Partial<HomeworkInput>) {
    return prisma.assignment.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
  }

  async deleteHomework(id: string) {
    return prisma.assignment.delete({ where: { id } });
  }

  // ── Student Portal: homework for a student ─────────────────────────────────

  async getStudentHomework(studentId: string, filters?: { status?: string; subjectId?: string }) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { gradeId: true, sectionId: true },
    });
    if (!student) throw new Error('Student not found');

    const where: any = {
      gradeId: student.gradeId,
      status: 'PUBLISHED',
      OR: [
        { sectionId: student.sectionId },
        { sectionId: null },
      ],
    };
    if (filters?.subjectId) where.subjectId = filters.subjectId;

    const homeworks = await prisma.assignment.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        teacher: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        submissions: {
          where: { studentId },
          select: { id: true, status: true, score: true, submittedAt: true, feedback: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return homeworks.map((hw) => ({
      ...hw,
      submission: hw.submissions[0] || null,
      isSubmitted: hw.submissions.length > 0,
      isOverdue: new Date(hw.dueDate) < new Date() && hw.submissions.length === 0,
    }));
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  async submitHomework(assignmentId: string, studentId: string, data: SubmissionInput) {
    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });

    if (existing) {
      return prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: {
          submissionText: data.submissionText,
          attachments: data.attachments || null,
          status: 'SUBMITTED',
        },
      });
    }

    return prisma.assignmentSubmission.create({
      data: {
        assignmentId,
        studentId,
        submissionText: data.submissionText,
        attachments: data.attachments || null,
        status: 'SUBMITTED',
      },
    });
  }

  async gradeSubmission(
    submissionId: string,
    gradedById: string,
    data: { score: number; feedback?: string }
  ) {
    return prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: data.score,
        feedback: data.feedback,
        status: 'GRADED',
        gradedById,
        gradedAt: new Date(),
      },
    });
  }

  async getSubmissionsForHomework(assignmentId: string) {
    return prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            student_id: true,
            grade: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }
}

// ─── Learning Material Service ───────────────────────────────────────────────

export interface LearningMaterialInput {
  title: string;
  description?: string;
  subjectId: string;
  gradeId: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedById?: string;
}

export class LearningMaterialService {
  async getMaterials(filters: { gradeId?: string; subjectId?: string }) {
    const where: any = {};
    if (filters.gradeId) where.gradeId = filters.gradeId;
    if (filters.subjectId) where.subjectId = filters.subjectId;

    return prisma.learningMaterial.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        grade: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMaterialById(id: string) {
    return prisma.learningMaterial.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        grade: { select: { id: true, name: true } },
      },
    });
  }

  async createMaterial(data: LearningMaterialInput) {
    return prisma.learningMaterial.create({
      data: {
        title: data.title,
        description: data.description,
        subjectId: data.subjectId,
        gradeId: data.gradeId,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        uploadedById: data.uploadedById || null,
      },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        grade: { select: { id: true, name: true } },
      },
    });
  }

  async updateMaterial(id: string, data: Partial<LearningMaterialInput>) {
    return prisma.learningMaterial.update({
      where: { id },
      data,
      include: {
        subject: { select: { id: true, name: true, color: true } },
        grade: { select: { id: true, name: true } },
      },
    });
  }

  async deleteMaterial(id: string) {
    return prisma.learningMaterial.delete({ where: { id } });
  }

  async getStudentMaterials(studentId: string, filters?: { subjectId?: string }) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { gradeId: true },
    });
    if (!student) throw new Error('Student not found');

    const where: any = { gradeId: student.gradeId };
    if (filters?.subjectId) where.subjectId = filters.subjectId;

    return prisma.learningMaterial.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true, color: true } },
        grade: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const homeworkService = new HomeworkService();
export const learningMaterialService = new LearningMaterialService();
