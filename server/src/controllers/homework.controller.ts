import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { homeworkService } from '../services/homework.service';

export const getHomework = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, subjectId, teacherId, status } = req.query as any;
    const data = await homeworkService.getHomework({ gradeId, sectionId, subjectId, teacherId, status });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const getHomeworkById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hw = await homeworkService.getHomeworkById(req.params.id);
    if (!hw) return res.status(404).json({ success: false, message: 'Homework not found' });
    res.status(200).json({ success: true, data: hw });
  } catch (error) { next(error); }
};

export const createHomework = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hw = await homeworkService.createHomework(req.body);
    res.status(201).json({ success: true, data: hw });
  } catch (error) { next(error); }
};

export const updateHomework = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hw = await homeworkService.updateHomework(req.params.id, req.body);
    res.status(200).json({ success: true, data: hw });
  } catch (error) { next(error); }
};

export const deleteHomework = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await homeworkService.deleteHomework(req.params.id);
    res.status(200).json({ success: true, message: 'Homework deleted' });
  } catch (error) { next(error); }
};

export const getSubmissions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await homeworkService.getSubmissionsForHomework(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const submitHomework = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id: assignmentId } = req.params;
    const { studentId, submissionText, attachments } = req.body;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required' });
    const data = await homeworkService.submitHomework(assignmentId, studentId, { submissionText, attachments });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const gradeSubmission = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { submissionId } = req.params;
    const gradedById = req.user?.id || '';
    const { score, feedback } = req.body;
    const data = await homeworkService.gradeSubmission(submissionId, gradedById, { score, feedback });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const getStudentHomework = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { subjectId } = req.query as any;
    const data = await homeworkService.getStudentHomework(studentId, { subjectId });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};
