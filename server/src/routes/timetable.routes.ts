import { Router } from 'express';
import * as timetableController from '../controllers/timetable.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Roles with management privileges
const ACADEMIC_MANAGERS = ['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar'];
// Roles with read access to schedules
const ALL_PORTAL_ROLES = ['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar', 'teacher', 'student', 'parent'];

// Read endpoints
router.get('/', authorize(ALL_PORTAL_ROLES), timetableController.listTimetables);
router.get('/periods', authorize(ALL_PORTAL_ROLES), timetableController.getPeriods);
router.put('/periods', authorize(ACADEMIC_MANAGERS), timetableController.updatePeriods);
router.get('/classrooms', authorize(ALL_PORTAL_ROLES), timetableController.getClassrooms);
router.get('/my-schedule', authorize(['teacher', 'admin', 'school_admin', 'academic_head']), timetableController.getMySchedule);
router.get('/teacher/:teacherId', authorize(ALL_PORTAL_ROLES), timetableController.getTeacherSchedule);

// Management endpoints
router.post('/check-conflict', authorize(ACADEMIC_MANAGERS), timetableController.checkConflict);
router.post('/', authorize(ACADEMIC_MANAGERS), timetableController.createTimetable);

router.get('/:id', authorize(ALL_PORTAL_ROLES), timetableController.getTimetableById);
router.put('/:id', authorize(ACADEMIC_MANAGERS), timetableController.updateTimetable);
router.post('/:id/validate', authorize(ACADEMIC_MANAGERS), timetableController.validateTimetable);
router.post('/:id/duplicate', authorize(ACADEMIC_MANAGERS), timetableController.duplicateTimetable);

// Slot operations
router.post('/:timetableId/slots', authorize(ACADEMIC_MANAGERS), timetableController.upsertSlot);
router.post('/:timetableId/slots/move-copy', authorize(ACADEMIC_MANAGERS), timetableController.copyOrMoveSlot);
router.delete('/:timetableId/slots/:slotId', authorize(ACADEMIC_MANAGERS), timetableController.deleteSlot);

export default router;
