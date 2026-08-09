import { Router, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// Get settings for a school
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const settings = await settingsService.getSettings(schoolId);
    res.status(200).json({ success: true, data: settings });
  } catch (error) { next(error); }
});

// Update settings for a school
router.put('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const settings = await settingsService.updateSettings(schoolId, req.body);
    res.status(200).json({ success: true, data: settings });
  } catch (error) { next(error); }
});

export default router;

