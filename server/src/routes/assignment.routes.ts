import { Router, Response, NextFunction } from 'express';
import * as assignmentService from '../services/assignment.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// ─── Teacher Portal ───────────────────────────────────────────────────────────
router.get('/teacher-portal/classes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const data = await assignmentService.getTeacherPortalClasses(userId);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
});

router.get('/teacher-portal/class-details', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { gradeId, sectionId, subjectId, academicYearId } = req.query;
    if (!gradeId || !sectionId) {
      return res.status(400).json({ success: false, message: 'gradeId and sectionId are required' });
    }
    const data = await assignmentService.getTeacherClassDetails(userId, {
      gradeId: gradeId as string,
      sectionId: sectionId as string,
      subjectId: subjectId as string | undefined,
      academicYearId: academicYearId as string | undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
});

// ─── Admin: Assignment CRUD ───────────────────────────────────────────────────
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { teacherId, role, gradeId, sectionId, subjectId, academicYearId } = req.query;
    const assignments = await assignmentService.getAssignments(undefined, teacherId as string, {
      role: role as string | undefined,
      gradeId: gradeId as string | undefined,
      sectionId: sectionId as string | undefined,
      subjectId: subjectId as string | undefined,
      academicYearId: academicYearId as string | undefined,
    });
    res.status(200).json({ success: true, data: assignments });
  } catch (error) { next(error); }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await assignmentService.createAssignment(req.body);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) { next(error); }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await assignmentService.updateAssignment(req.params.id, req.body);
    res.status(200).json({ success: true, data: assignment });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await assignmentService.deleteAssignment(req.params.id);
    res.status(200).json({ success: true, message: 'Assignment removed' });
  } catch (error) { next(error); }
});

export default router;
