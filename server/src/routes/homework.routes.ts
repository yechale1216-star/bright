import { Router } from 'express';
import * as homeworkController from '../controllers/homework.controller';

const router = Router();

// ─── Teacher: Homework CRUD ──────────────────────────────────────────────────
router.get('/', homeworkController.getHomework);
router.get('/:id', homeworkController.getHomeworkById);
router.post('/', homeworkController.createHomework);
router.put('/:id', homeworkController.updateHomework);
router.delete('/:id', homeworkController.deleteHomework);

// ─── Submissions ─────────────────────────────────────────────────────────────
router.get('/:id/submissions', homeworkController.getSubmissions);
router.post('/:id/submit', homeworkController.submitHomework);
router.put('/submissions/:submissionId/grade', homeworkController.gradeSubmission);

// ─── Student Portal ───────────────────────────────────────────────────────────
router.get('/student/:studentId', homeworkController.getStudentHomework);

export default router;
