import { Router, Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as schoolService from '../services/school.service';

const router = Router();

// Get all grades
router.get('/me/grades', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const grades = await schoolService.getGrades();
    res.status(200).json({ success: true, data: grades });
  } catch (error) { next(error); }
});

// Get all sections
router.get('/me/sections', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sections = await schoolService.getSections();
    res.status(200).json({ success: true, data: sections });
  } catch (error) { next(error); }
});

// Get all streams
router.get('/me/streams', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const streams = await schoolService.getStreams();
    res.status(200).json({ success: true, data: streams });
  } catch (error) { next(error); }
});

// Create or upsert school
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const school = await schoolService.createSchool(req.body);
    res.status(200).json({ success: true, data: school });
  } catch (error) { next(error); }
});

// Update school by ID
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const school = await schoolService.updateSchool(req.params.id, req.body);
    res.status(200).json({ success: true, data: school });
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

