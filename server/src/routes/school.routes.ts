import { Router, Request, Response, NextFunction } from 'express';
import { authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../config/db';
import * as schoolService from '../services/school.service';

const router = Router();

// Get all grades for current school
router.get('/me/grades', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const grades = await schoolService.getGrades(schoolId);
    res.status(200).json({ success: true, data: grades });
  } catch (error) { next(error); }
});

// Get all sections for current school
router.get('/me/sections', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const sections = await schoolService.getSections(schoolId);
    res.status(200).json({ success: true, data: sections });
  } catch (error) { next(error); }
});

// Get all streams for current school
router.get('/me/streams', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const streams = await schoolService.getStreams(schoolId);
    res.status(200).json({ success: true, data: streams });
  } catch (error) { next(error); }
});

// Get school by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    let school;
    if (id.startsWith('SCH-')) {
      school = await schoolService.getSchoolByCustomId(id);
    } else {
      school = await schoolService.getSchoolById(id);
    }
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    res.status(200).json({ success: true, data: school });
  } catch (error) { next(error); }
});

export default router;
