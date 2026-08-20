import { Router, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service';
import { AuthenticatedRequest, authorize } from '../middleware/auth.middleware';
import * as holidayService from '../services/holiday.service';

const router = Router();

// Get settings
router.get('/', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) { next(error); }
});

// Update settings
router.put('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.updateSettings(undefined, req.body);
    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    if (error instanceof settingsService.ScheduleValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }
    next(error);
  }
});

// GET /api/settings/holidays — list holidays
router.get('/holidays', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const holidays = await holidayService.getSchoolHolidays(undefined, { startDate, endDate, includeInactive });
    res.status(200).json({ success: true, data: holidays });
  } catch (error) { next(error); }
});

// GET /api/settings/is-working-day — check working day status for a specific date
router.get('/is-working-day', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string;
    const status = await holidayService.isDateWorkingDay(undefined, date);
    res.status(200).json({ success: true, data: status });
  } catch (error) { next(error); }
});

// POST /api/settings/holidays — create holiday (admin only)
router.post('/holidays', authorize(['admin', 'school_admin']), async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const holiday = await holidayService.createSchoolHoliday(undefined, req.body);
    res.status(201).json({ success: true, data: holiday, message: 'Holiday created successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to create holiday' });
  }
});

// PUT /api/settings/holidays/:id — update holiday (admin only)
router.put('/holidays/:id', authorize(['admin', 'school_admin']), async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const holiday = await holidayService.updateSchoolHoliday(req.params.id, undefined, req.body);
    res.status(200).json({ success: true, data: holiday, message: 'Holiday updated successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update holiday' });
  }
});

// DELETE /api/settings/holidays/:id — delete holiday (admin only)
router.delete('/holidays/:id', authorize(['admin', 'school_admin']), async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    await holidayService.deleteSchoolHoliday(req.params.id, undefined);
    res.status(200).json({ success: true, message: 'Holiday deleted successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete holiday' });
  }
});

export default router;


