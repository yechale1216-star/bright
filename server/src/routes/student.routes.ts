import { Router } from 'express';
import * as studentController from '../controllers/student.controller';
import { validateStudent } from '../middleware/validate';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Static routes MUST come before dynamic /:id routes
router.get('/', studentController.getStudents);
router.get('/auto/next-id', studentController.getNextStudentId);
router.get('/parent/:phone', studentController.getStudentsByParentPhone);
router.post('/', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), validateStudent, studentController.createStudent);
router.post('/bulk', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), studentController.bulkCreateStudents);

// Dynamic routes last
router.get('/:id', studentController.getStudentById);
router.put('/:id', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), studentController.updateStudent);
router.delete('/:id', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), studentController.deleteStudent);

export default router;
