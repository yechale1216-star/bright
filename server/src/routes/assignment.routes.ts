import { Router, Response, NextFunction } from 'express';
import * as assignmentService from '../services/assignment.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// Get assignments for a school (optionally filtered by teacherId)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { teacherId } = req.query;
    const assignments = await assignmentService.getAssignments(schoolId, teacherId as string);
    res.status(200).json({ success: true, data: assignments });
  } catch (error) { next(error); }
});

// Create assignment
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const assignment = await assignmentService.createAssignment(req.body, schoolId);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) { next(error); }
});

// Update assignment
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const assignment = await assignmentService.updateAssignment(req.params.id, req.body, schoolId);
    res.status(200).json({ success: true, data: assignment });
  } catch (error) { next(error); }
});

// Delete assignment
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await assignmentService.deleteAssignment(req.params.id, schoolId);
    res.status(200).json({ success: true, message: 'Assignment removed' });
  } catch (error) { next(error); }
});

export default router;

