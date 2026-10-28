import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { gradebookService } from '../services/gradebook.service';
import { verifyTeacherClassSubjectAccess } from '../services/assignment.service';
import { assessmentReportService } from '../services/assessment-report.service';

/**
 * Grading Scales
 */
export const getGradingScales = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const scales = await gradebookService.getGradingScales();
    res.status(200).json({ success: true, data: scales });
  } catch (error) {
    next(error);
  }
};

export const createGradingScale = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const scale = await gradebookService.createGradingScale(req.body);
    res.status(201).json({ success: true, data: scale });
  } catch (error) {
    next(error);
  }
};

export const updateGradingScale = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scale = await gradebookService.updateGradingScale(id, req.body);
    res.status(200).json({ success: true, data: scale });
  } catch (error) {
    next(error);
  }
};

export const deleteGradingScale = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await gradebookService.deleteGradingScale(id);
    res.status(200).json({ success: true, message: 'Grading scale deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Exams
 */
export const getExams = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId } = req.query as { academicYearId?: string; academicTermId?: string };
    const exams = await gradebookService.getExams({ academicYearId, academicTermId });
    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};

export const createExam = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const exam = await gradebookService.createExam(req.body);
    res.status(201).json({ success: true, data: exam });
  } catch (error) {
    next(error);
  }
};

export const updateExam = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const exam = await gradebookService.updateExam(id, req.body);
    res.status(200).json({ success: true, data: exam });
  } catch (error) {
    next(error);
  }
};

export const deleteExam = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await gradebookService.deleteExam(id);
    res.status(200).json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Assessments
 */
export const getAssessments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let { examId, gradeId, sectionId, subjectId, academicYearId, academicTermId } = req.query as any;
    const userId = req.user?.id;
    if (userId && req.user?.role === 'teacher') {
      const { teacherAccessService } = await import('../services/teacher-access.service');
      const access = await teacherAccessService.validateTeacherActiveAccess(userId);
      if (!access.allowed) {
        return res.status(403).json({ success: false, code: access.code, message: access.message });
      }
      if (academicYearId && academicYearId !== access.currentYear?.id) {
        return res.status(403).json({ success: false, message: 'Access denied. Teachers cannot access historical or future academic years.' });
      }
      academicYearId = access.currentYear?.id;
    }
    const assessments = await gradebookService.getAssessments({
      examId,
      gradeId,
      sectionId,
      subjectId,
      academicYearId,
      academicTermId,
    });
    res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    next(error);
  }
};

export const getAssessmentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const assessment = await gradebookService.getAssessmentById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
};

export const createAssessment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { gradeId, subjectId, sectionId } = req.body;
    if (userId && req.user?.role === 'teacher') {
      const { teacherAccessService } = await import('../services/teacher-access.service');
      const access = await teacherAccessService.validateTeacherActiveAccess(userId);
      if (!access.allowed) {
        return res.status(403).json({ success: false, code: access.code, message: access.message });
      }
      if (req.body.academicYearId && req.body.academicYearId !== access.currentYear?.id) {
        return res.status(403).json({ success: false, message: 'Access denied. You cannot create assessments for another academic year.' });
      }
      req.body.academicYearId = access.currentYear?.id;
    }

    if (userId && req.user?.role === 'teacher') {
      const { academicYearService } = await import('../services/academic-year.service');
      const termValidation = await academicYearService.validateMarkEntryWindow(req.body.academicTermId, req.body.academicYearId);
      if (!termValidation.allowed) {
        return res.status(403).json({ success: false, code: termValidation.code, message: termValidation.message });
      }
    }

    if (userId && gradeId && subjectId) {
      const access = await verifyTeacherClassSubjectAccess(userId, { gradeId, subjectId, sectionId });
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason || 'You are not assigned to this grade and subject.' });
      }
    }

    const assessment = await gradebookService.createAssessment(req.body);
    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
};

export const updateAssessment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (userId && req.user?.role === 'teacher') {
      const existing = await gradebookService.getAssessmentById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Assessment not found' });
      }
      const { academicYearService } = await import('../services/academic-year.service');
      const termValidation = await academicYearService.validateMarkEntryWindow(existing.academicTermId || undefined, existing.academicYearId);
      if (!termValidation.allowed) {
        return res.status(403).json({ success: false, code: termValidation.code, message: termValidation.message });
      }
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Assessment not found' });
      }
      const access = await verifyTeacherClassSubjectAccess(userId, {
        gradeId: existing.gradeId,
        subjectId: existing.subjectId,
        sectionId: existing.sectionId,
      });
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason || 'You are not assigned to this grade and subject.' });
      }
    }

    const assessment = await gradebookService.updateAssessment(id, req.body);
    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
};

export const deleteAssessment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (userId && req.user?.role === 'teacher') {
      const existing = await gradebookService.getAssessmentById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Assessment not found' });
      }
      const access = await verifyTeacherClassSubjectAccess(userId, {
        gradeId: existing.gradeId,
        subjectId: existing.subjectId,
        sectionId: existing.sectionId,
      });
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason || 'You are not assigned to this grade and subject.' });
      }
    }

    await gradebookService.deleteAssessment(id);
    res.status(200).json({ success: true, message: 'Assessment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Marks Sheet & Entry
 */
export const getMarksSheet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user?.id;

    // Verify teacher is assigned to this assessment's grade+subject before showing the sheet
    if (userId) {
      const assessment = await gradebookService.getAssessmentById(assessmentId);
      if (!assessment) {
        return res.status(404).json({ success: false, message: 'Assessment not found' });
      }
      const access = await verifyTeacherClassSubjectAccess(userId, {
        gradeId: assessment.gradeId,
        subjectId: assessment.subjectId,
        sectionId: assessment.sectionId,
      });
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason || 'You are not assigned to this assessment\'s grade and subject.' });
      }
    }

    const sheet = await gradebookService.getMarksSheet(assessmentId);
    res.status(200).json({ success: true, data: sheet });
  } catch (error) {
    next(error);
  }
};

export const saveBulkMarks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { assessmentId, marks } = req.body;
    const gradedById = req.user?.id;
    if (!assessmentId || !Array.isArray(marks)) {
      return res.status(400).json({ success: false, message: 'assessmentId and marks array are required' });
    }

    // Verify the teacher is assigned to this assessment's grade+subject before saving marks
    if (gradedById) {
      const assessment = await gradebookService.getAssessmentById(assessmentId);
      if (!assessment) {
        return res.status(404).json({ success: false, message: 'Assessment not found' });
      }
      const access = await verifyTeacherClassSubjectAccess(gradedById, {
        gradeId: assessment.gradeId,
        subjectId: assessment.subjectId,
        sectionId: assessment.sectionId,
      });
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason || 'You are not assigned to this assessment\'s grade and subject.' });
      }
    }

    const result = await gradebookService.saveBulkMarks(assessmentId, marks, gradedById);
    res.status(200).json({ success: true, data: result, message: 'Marks saved successfully' });
  } catch (error: any) {
    if (error.status === 403 || error.code) {
      return res.status(error.status || 403).json({ success: false, code: error.code || 'TERM_RESTRICTION', message: error.message });
    }
    next(error);
  }
};

export const getStudentMarks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { academicYearId, academicTermId } = req.query as any;
    const marks = await gradebookService.getStudentMarks(studentId, academicYearId, academicTermId);
    res.status(200).json({ success: true, data: marks });
  } catch (error) {
    next(error);
  }
};

/**
 * Report Cards
 */
export const generateReportCards = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, academicYearId, academicTermId } = req.body;
    if (!gradeId || !sectionId || !academicYearId || !academicTermId) {
      return res.status(400).json({
        success: false,
        message: 'gradeId, sectionId, academicYearId, and academicTermId are required',
      });
    }

    const result = await gradebookService.generateReportCards({
      gradeId,
      sectionId,
      academicYearId,
      academicTermId,
    });

    res.status(200).json({ success: true, data: result, message: `Successfully generated ${result.count} report cards.` });
  } catch (error) {
    next(error);
  }
};

export const getReportCards = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, streamId, academicYearId, academicTermId, status } = req.query as any;
    const cards = await gradebookService.getReportCards({
      gradeId,
      sectionId,
      streamId,
      academicYearId,
      academicTermId,
      status,
    });
    res.status(200).json({ success: true, data: cards });
  } catch (error) {
    next(error);
  }
};

export const getReportCardById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const card = await gradebookService.getReportCardById(id);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Report card not found' });
    }
    res.status(200).json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
};

export const updateReportCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const card = await gradebookService.updateReportCard(id, req.body);
    res.status(200).json({ success: true, data: card, message: 'Report card updated' });
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateReportCardStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      return res.status(400).json({ success: false, message: 'ids array and status are required' });
    }
    const result = await gradebookService.bulkUpdateStatus(ids, status);
    res.status(200).json({ success: true, data: result, message: `Updated ${result.count} report cards to ${status}` });
  } catch (error) {
    next(error);
  }
};

export const getReportCardReadiness = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, academicYearId, academicTermId, reportCardId } = req.query as any;
    if (reportCardId) {
      const result = await gradebookService.validateReportCardReadiness(reportCardId);
      return res.status(200).json({ success: true, data: result });
    }
    if (!gradeId || !sectionId || !academicYearId) {
      return res.status(400).json({
        success: false,
        message: 'gradeId, sectionId, and academicYearId query parameters are required',
      });
    }
    const overview = await gradebookService.getClassReadinessOverview({
      gradeId,
      sectionId,
      academicYearId,
      academicTermId: academicTermId || undefined,
    });
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
};

export const publishReportCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const publisherId = req.user?.id;
    const published = await gradebookService.publishReportCard(id, publisherId);
    res.status(200).json({
      success: true,
      data: published,
      message: `Report card published successfully for ${published.student.fullName}`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error?.message || 'Failed to publish report card',
    });
  }
};

export const bulkPublishReportCards = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, academicYearId, academicTermId, reportCardIds } = req.body;
    if (!gradeId || !sectionId || !academicYearId) {
      return res.status(400).json({
        success: false,
        message: 'gradeId, sectionId, and academicYearId are required',
      });
    }

    // If academicTermId is not provided, fetch the first term of the year or use empty
    let termId = academicTermId;
    if (!termId) {
      const year = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        include: { terms: { orderBy: { startDate: 'asc' }, take: 1 } },
      });
      termId = year?.terms?.[0]?.id || '';
    }

    const publisherId = req.user?.id;
    const result = await gradebookService.bulkPublishReportCards(
      { gradeId, sectionId, academicYearId, academicTermId: termId, reportCardIds },
      publisherId
    );
    res.status(200).json({
      success: true,
      data: {
        ...result,
        published: result.publishedCount,
        skipped: result.skippedCount,
      },
      message: `Successfully published ${result.publishedCount} report cards. ${result.skippedCount} skipped due to incomplete marks.`,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error?.message || 'Failed to execute bulk publication',
    });
  }
};

export const getStudentReportCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { academicTermId, academicYearId } = req.query as any;
    const reportCards = await gradebookService.getStudentReportCard(studentId, academicTermId, academicYearId);
    res.status(200).json({ success: true, data: reportCards });
  } catch (error) {
    next(error);
  }
};

export const getComprehensiveReportCard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { studentId, academicYearId, academicTermId } = req.query as any;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId query parameter is required' });
    }

    // Role check: Students and Parents must NOT see draft or unpublished report cards
    const userRole = req.user?.role;
    if (userRole === 'student' || userRole === 'parent') {
      const isPublished = await gradebookService.isReportCardPublished(studentId, academicYearId, academicTermId);
      if (!isPublished) {
        return res.status(403).json({
          success: false,
          message: 'Report card has not been published yet. Please check back after official publication.',
        });
      }
    }

    const reportCard = await gradebookService.getComprehensiveReportCardData({
      studentId,
      academicYearId,
      academicTermId,
    });
    res.status(200).json({ success: true, data: reportCard });
  } catch (error) {
    next(error);
  }
};

export const getBatchComprehensiveReportCards = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, academicYearId, academicTermId } = req.query as any;
    if (!gradeId || !sectionId) {
      return res.status(400).json({ success: false, message: 'gradeId and sectionId query parameters are required' });
    }
    const cards = await gradebookService.getBatchComprehensiveReportCards({
      gradeId,
      sectionId,
      academicYearId,
      academicTermId,
    });
    res.status(200).json({ success: true, data: cards });
  } catch (error) {
    next(error);
  }
};

export const verifyReportCard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await gradebookService.verifyReportCard(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'No official report card found for this verification code.',
      });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Assessment Submissions & Approval
 */
export const getSubmissionDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const data = await assessmentSubmissionService.getDashboardMetrics(req.query as any);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getSubmissions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const result = await assessmentSubmissionService.getSubmissions(req.query as any);
    res.status(200).json({ success: true, data: result.submissions, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const syncSubmissions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId } = req.body || {};
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const synced = await assessmentSubmissionService.syncSubmissions(academicYearId, academicTermId);
    res.status(200).json({ success: true, count: synced, message: `Successfully synced ${synced} submissions` });
  } catch (error) {
    next(error);
  }
};

export const getSubmissionDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const details = await assessmentSubmissionService.getSubmissionDetails(id);
    res.status(200).json({ success: true, data: details });
  } catch (error) {
    next(error);
  }
};

export const approveSubmission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.id;
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const updated = await assessmentSubmissionService.approveSubmission(id, reviewerId);
    res.status(200).json({ success: true, data: updated, message: 'Submission approved successfully' });
  } catch (error) {
    next(error);
  }
};

export const returnSubmission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user?.id;
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const updated = await assessmentSubmissionService.returnSubmission(id, reason, reviewerId);
    res.status(200).json({ success: true, data: updated, message: 'Submission returned for correction' });
  } catch (error) {
    next(error);
  }
};

export const reopenSubmission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user?.id;
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const updated = await assessmentSubmissionService.reopenSubmission(id, reason, reviewerId);
    res.status(200).json({ success: true, data: updated, message: 'Submission reopened for editing' });
  } catch (error) {
    next(error);
  }
};

export const publishSubmission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const publisherId = req.user?.id;
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const updated = await assessmentSubmissionService.publishSubmission(id, publisherId);
    res.status(200).json({ success: true, data: updated, message: 'Results published successfully' });
  } catch (error) {
    next(error);
  }
};

export const bulkApproveSubmissions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    const reviewerId = req.user?.id;
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const result = await assessmentSubmissionService.bulkApproveSubmissions(ids, reviewerId);
    res.status(200).json({ success: true, data: result, message: `Successfully approved ${result.totalApproved} submissions` });
  } catch (error) {
    next(error);
  }
};

export const teacherSubmitMarks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, notes } = req.body;
    let teacherId = req.body.teacherId;
    if (!teacherId && req.user?.id) {
      const teacher = await (await import('../config/db')).default.teacher.findFirst({
        where: { user_id: req.user.id },
      });
      if (teacher) teacherId = teacher.id;
    }
    const { assessmentSubmissionService } = await import('../services/assessment-submission.service');
    const result = await assessmentSubmissionService.teacherSubmitMarks({
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId,
      teacherId,
      notes,
    });
    res.status(200).json({ success: true, data: result, message: 'Marks submitted for admin approval' });
  } catch (error: any) {
    if (error.status === 403 || error.code) {
      return res.status(error.status || 403).json({ success: false, code: error.code || 'TERM_RESTRICTION', message: error.message });
    }
    next(error);
  }
};

export const getClassGradebook = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId } = req.query as any;
    const userId = req.user?.id;

    if (!academicYearId || !gradeId || !sectionId || !subjectId) {
      return res.status(400).json({
        success: false,
        message: 'academicYearId, gradeId, sectionId, and subjectId are required',
      });
    }

    if (userId) {
      const access = await verifyTeacherClassSubjectAccess(userId, { gradeId, subjectId, sectionId });
      if (!access.allowed) {
        return res.status(403).json({
          success: false,
          message: access.reason || 'You are not assigned to this grade and subject.',
        });
      }
    }

    const data = await gradebookService.getClassGradebook({
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId,
      userId,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const saveClassMarks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, marks } = req.body;
    const userId = req.user?.id;

    if (!academicYearId || !gradeId || !sectionId || !subjectId || !Array.isArray(marks)) {
      return res.status(400).json({
        success: false,
        message: 'academicYearId, gradeId, sectionId, subjectId, and marks array are required',
      });
    }

    if (userId) {
      const access = await verifyTeacherClassSubjectAccess(userId, { gradeId, subjectId, sectionId });
      if (!access.allowed) {
        return res.status(403).json({
          success: false,
          message: access.reason || 'You are not assigned to this grade and subject.',
        });
      }
    }

    const result = await gradebookService.saveClassMarks({
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId,
      marks,
      gradedById: userId,
    });

    res.status(200).json({ success: true, data: result, message: 'Class marks saved successfully' });
  } catch (error: any) {
    if (error.status === 403 || error.code) {
      return res.status(error.status || 403).json({ success: false, code: error.code || 'TERM_RESTRICTION', message: error.message });
    }
    next(error);
  }
};

/**
 * Assessment Reports Analytics & Overview
 */
export const getAssessmentReportAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, streamId, studentId, reportType } = req.query as any;

    const data = await assessmentReportService.getAnalytics({
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId,
      streamId,
      studentId,
      reportType,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Detailed Assessment Report for preview, print & CSV export
 */
export const getDetailedAssessmentReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { reportId } = req.params;
    const { academicYearId, academicTermId, gradeId, sectionId, subjectId, streamId, studentId, reportType } = req.query as any;

    const data = await assessmentReportService.getDetailedReport(reportId, {
      academicYearId,
      academicTermId,
      gradeId,
      sectionId,
      subjectId,
      streamId,
      studentId,
      reportType,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};


