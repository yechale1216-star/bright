import { Router } from 'express';
import * as gradebookController from '../controllers/gradebook.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Grading Scales (School Admin only for config)
router.get('/scales', gradebookController.getGradingScales);
router.post('/scales', authorize(['admin', 'school_admin']), gradebookController.createGradingScale);
router.put('/scales/:id', authorize(['admin', 'school_admin']), gradebookController.updateGradingScale);
router.delete('/scales/:id', authorize(['admin', 'school_admin']), gradebookController.deleteGradingScale);

// Exams (Admin and Academic Head)
router.get('/exams', gradebookController.getExams);
router.post('/exams', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.createExam);
router.put('/exams/:id', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.updateExam);
router.delete('/exams/:id', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.deleteExam);

// Assessments
router.get('/assessments', gradebookController.getAssessments);
router.get('/assessments/:id', gradebookController.getAssessmentById);
router.post('/assessments', authorize(['admin', 'school_admin', 'academic_head', 'teacher']), gradebookController.createAssessment);
router.put('/assessments/:id', authorize(['admin', 'school_admin', 'academic_head', 'teacher']), gradebookController.updateAssessment);
router.delete('/assessments/:id', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.deleteAssessment);

// Marks Entry
router.get('/class-matrix', gradebookController.getClassGradebook);
router.post('/class-matrix/save', gradebookController.saveClassMarks);
router.get('/assessments/:assessmentId/marks-sheet', gradebookController.getMarksSheet);
router.post('/marks/bulk', gradebookController.saveBulkMarks);
router.get('/students/:studentId/marks', gradebookController.getStudentMarks);

// Report Cards
router.post('/report-cards/generate', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.generateReportCards);
router.get('/report-cards', gradebookController.getReportCards);
router.get('/report-cards/comprehensive', gradebookController.getComprehensiveReportCard);
router.get('/report-cards/batch-comprehensive', gradebookController.getBatchComprehensiveReportCards);
router.get('/report-cards/:id', gradebookController.getReportCardById);
router.put('/report-cards/:id', authorize(['admin', 'school_admin', 'academic_head', 'teacher']), gradebookController.updateReportCard);
router.post('/report-cards/bulk-status', authorize(['admin', 'school_admin']), gradebookController.bulkUpdateReportCardStatus);

// Mark Submission & Approval Workflow
router.get('/submissions/dashboard', gradebookController.getSubmissionDashboard);
router.get('/submissions', gradebookController.getSubmissions);
router.get('/submissions/:id/details', gradebookController.getSubmissionDetails);
router.post('/submissions/:id/approve', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.approveSubmission);
router.post('/submissions/:id/return', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.returnSubmission);
router.post('/submissions/:id/reopen', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.reopenSubmission);
router.post('/submissions/:id/publish', authorize(['admin', 'school_admin']), gradebookController.publishSubmission);
router.post('/submissions/bulk-approve', authorize(['admin', 'school_admin', 'academic_head']), gradebookController.bulkApproveSubmissions);
router.post('/submissions/submit', authorize(['admin', 'school_admin', 'academic_head', 'teacher']), gradebookController.teacherSubmitMarks);

// Assessment Reports Analytics & Detail
router.get('/reports/analytics', gradebookController.getAssessmentReportAnalytics);
router.get('/reports/:reportId/detail', gradebookController.getDetailedAssessmentReport);

export default router;

