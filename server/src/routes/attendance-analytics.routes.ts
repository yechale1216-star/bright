import { Router } from 'express';
import * as analyticsController from '../controllers/attendance-analytics.controller';
import { featureGuard } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', analyticsController.getAttendanceSummary);
router.get('/grade-stats', analyticsController.getGradeStats);
router.get('/trends', featureGuard('advanced_analytics'), analyticsController.getAttendanceTrends);
router.get('/drill-down/:gradeId', featureGuard('advanced_analytics'), analyticsController.getDrillDownStats);
router.get('/export', analyticsController.exportAttendance);

export default router;
