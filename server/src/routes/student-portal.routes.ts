import { Router } from 'express';
import * as studentPortalController from '../controllers/student-portal.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

// ─── Public Student Authentication Routes ───────────────────────────────────
export const publicStudentRouter = Router();
publicStudentRouter.post('/login', studentPortalController.login);
publicStudentRouter.post('/forgot-password', studentPortalController.forgotPassword);
publicStudentRouter.post('/verify-otp', studentPortalController.verifyOtp);
publicStudentRouter.post('/reset-password', studentPortalController.resetPassword);

// ─── Protected Student Portal Routes ─────────────────────────────────────────
// Requires valid authentication token and role must be 'student'
router.use(authMiddleware);
router.use(authorize(['student']));

router.get('/dashboard', studentPortalController.getDashboard);
router.get('/profile', studentPortalController.getProfile);
router.get('/classes', studentPortalController.getClasses);
router.get('/marks', studentPortalController.getMarks);
router.get('/attendance', studentPortalController.getAttendance);
router.get('/timetable', studentPortalController.getTimetable);
router.get('/announcements', studentPortalController.getAnnouncements);
router.get('/discipline', studentPortalController.getDiscipline);
router.get('/materials', studentPortalController.getMaterials);

export default router;
