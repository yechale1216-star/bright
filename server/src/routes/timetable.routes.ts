import { Router } from 'express';
import * as timetableController from '../controllers/timetable.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Allow admin, school_admin, super_admin, academic_head, registrar
const ACADEMIC_MANAGERS = ['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar'];

router.get('/', authorize(ACADEMIC_MANAGERS), timetableController.listTimetables);
router.get('/periods', authorize(ACADEMIC_MANAGERS), timetableController.getPeriods);
router.get('/classrooms', authorize(ACADEMIC_MANAGERS), timetableController.getClassrooms);
router.post('/check-conflict', authorize(ACADEMIC_MANAGERS), timetableController.checkConflict);
router.post('/', authorize(ACADEMIC_MANAGERS), timetableController.createTimetable);

router.get('/:id', authorize(ACADEMIC_MANAGERS), timetableController.getTimetableById);
router.put('/:id', authorize(ACADEMIC_MANAGERS), timetableController.updateTimetable);

router.post('/:timetableId/slots', authorize(ACADEMIC_MANAGERS), timetableController.upsertSlot);
router.delete('/:timetableId/slots/:slotId', authorize(ACADEMIC_MANAGERS), timetableController.deleteSlot);

export default router;
