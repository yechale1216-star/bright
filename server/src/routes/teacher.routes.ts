import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as schoolService from '../services/school.service';

const router = Router();

// GET /api/teachers
router.get('/', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const teachers = await schoolService.getTeachers();
    res.status(200).json({ success: true, data: teachers });
  } catch (error) {
    next(error);
  }
});

export default router;
