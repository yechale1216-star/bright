import { Router, Response, NextFunction } from 'express';
import * as staffAttendanceController from '../controllers/staff-attendance.controller';
import { authorize, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * Middleware: blocks non-staff users (parent, student) from staff attendance endpoints.
 * Custom staff roles (accountant, librarian, etc.) are allowed through as they are
 * validated at the service level (user must exist in school with is_active=true).
 */
const blockNonStaff = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (!role) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (role === 'parent' || role === 'student') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Parents and students cannot access staff attendance endpoints.'
    });
  }
  next();
};

// ─── Staff SELF-SERVICE routes — all staff roles (custom included), no parents/students
router.post('/check-in', blockNonStaff, staffAttendanceController.checkIn);
router.post('/check-out', blockNonStaff, staffAttendanceController.checkOut);
router.get('/my', blockNonStaff, staffAttendanceController.getMyAttendance);
router.get('/face-descriptor/:userId?', blockNonStaff, staffAttendanceController.getEnrolledDescriptor);
router.post('/sync', blockNonStaff, staffAttendanceController.bulkSync);

// Face enrollment (staff self-service or admin assisted)
router.post('/face-enroll', blockNonStaff, staffAttendanceController.enrollFace);

// Admin-only management
router.get('/stats', authorize(['admin', 'school_admin']), staffAttendanceController.getStats);
router.get('/report', authorize(['admin', 'school_admin']), staffAttendanceController.getReport);
router.get('/', authorize(['admin', 'school_admin']), staffAttendanceController.getStaffAttendance);
router.post('/mark-absent', authorize(['admin', 'school_admin']), staffAttendanceController.markAbsent);
router.post('/process-absences', authorize(['admin', 'school_admin']), staffAttendanceController.processAbsences);
router.post('/leave', authorize(['admin', 'school_admin']), staffAttendanceController.setLeave);
router.patch('/:id', authorize(['admin', 'school_admin']), staffAttendanceController.correctRecord);

export default router;

