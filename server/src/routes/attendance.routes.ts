import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { validateAttendance } from '../middleware/validate';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/', validateAttendance, attendanceController.markAttendance);
router.post('/bulk', attendanceController.bulkMarkAttendance);
router.get('/dashboard-summary', attendanceController.getDashboardSummary);
router.get('/', attendanceController.getAttendance);
router.get('/student/:studentId', attendanceController.getAttendanceByStudent);

// Edit Permission Requests & Audit Logs
router.post('/edit-requests', attendanceController.createEditRequest);
router.get('/edit-requests', attendanceController.getEditRequests);
router.put('/edit-requests/:id/approve', authorize(['admin', 'school_admin', 'super_admin', 'academic_head']), attendanceController.approveEditRequest);
router.put('/edit-requests/:id/reject', authorize(['admin', 'school_admin', 'super_admin', 'academic_head']), attendanceController.rejectEditRequest);
router.get('/audit-logs', authorize(['admin', 'school_admin', 'super_admin', 'academic_head', 'discipline_officer']), attendanceController.getAuditLogs);

export default router;

