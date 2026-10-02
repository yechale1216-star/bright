import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { validateAttendance } from '../middleware/validate';

const router = Router();

router.post('/', validateAttendance, attendanceController.markAttendance);
router.post('/bulk', attendanceController.bulkMarkAttendance);
router.get('/dashboard-summary', attendanceController.getDashboardSummary);
router.get('/', attendanceController.getAttendance);
router.get('/student/:studentId', attendanceController.getAttendanceByStudent);

// Edit Permission Requests & Audit Logs
router.post('/edit-requests', attendanceController.createEditRequest);
router.get('/edit-requests', attendanceController.getEditRequests);
router.put('/edit-requests/:id/approve', attendanceController.approveEditRequest);
router.put('/edit-requests/:id/reject', attendanceController.rejectEditRequest);
router.get('/audit-logs', attendanceController.getAuditLogs);

export default router;

