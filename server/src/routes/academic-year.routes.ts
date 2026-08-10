import { Router } from 'express';
import * as academicYearController from '../controllers/academic-year.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Routes for academic year management (Admin / School Admin)
router.get('/', authorize(['admin', 'school_admin', 'teacher']), academicYearController.getAcademicYears);
router.get('/current', authorize(['admin', 'school_admin', 'teacher', 'parent']), academicYearController.getCurrentAcademicYear);
router.post('/', authorize(['admin', 'school_admin']), academicYearController.createAcademicYear);
router.put('/:id', authorize(['admin', 'school_admin']), academicYearController.updateAcademicYear);
router.post('/:id/activate', authorize(['admin', 'school_admin']), academicYearController.activateAcademicYear);
router.delete('/:id', authorize(['admin', 'school_admin']), academicYearController.deleteAcademicYear);

export default router;
