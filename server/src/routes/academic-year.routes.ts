import { Router } from 'express';
import * as academicYearController from '../controllers/academic-year.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

const ALL_STAFF_AND_USERS = [
  'admin', 'school_admin', 'super_admin', 'teacher', 'academic_head', 
  'registrar', 'discipline_officer', 'librarian', 'transport_manager', 
  'staff_attendance_officer', 'hr_officer', 'parent', 'student'
];

const ACADEMIC_MANAGERS = ['admin', 'school_admin', 'super_admin', 'academic_head', 'registrar'];

// Routes for academic year management
router.get('/', authorize(ALL_STAFF_AND_USERS), academicYearController.getAcademicYears);
router.get('/current', authorize(ALL_STAFF_AND_USERS), academicYearController.getCurrentAcademicYear);
router.post('/', authorize(ACADEMIC_MANAGERS), academicYearController.createAcademicYear);
router.put('/:id', authorize(ACADEMIC_MANAGERS), academicYearController.updateAcademicYear);
router.post('/:id/activate', authorize(ACADEMIC_MANAGERS), academicYearController.activateAcademicYear);
router.delete('/:id', authorize(ACADEMIC_MANAGERS), academicYearController.deleteAcademicYear);

// Routes for terms management
router.get('/:yearId/terms', authorize(ALL_STAFF_AND_USERS), academicYearController.getTerms);
router.post('/:yearId/terms', authorize(ACADEMIC_MANAGERS), academicYearController.createTerm);
router.put('/terms/:id', authorize(ACADEMIC_MANAGERS), academicYearController.updateTerm);
router.delete('/terms/:id', authorize(ACADEMIC_MANAGERS), academicYearController.deleteTerm);

export default router;
