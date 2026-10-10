import { Router } from 'express';
import * as promotionController from '../controllers/promotion.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// School admins, super admins, and registrars can manage student promotions
router.get('/preview', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), promotionController.getPromotionPreview);
router.get('/preview/:gradeId/students', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), promotionController.getStudentsByGrade);
router.post('/promote', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), promotionController.promoteStudents);
router.get('/history', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), promotionController.getPromotionHistory);
router.post('/rollback/:id', authorize(['admin', 'school_admin', 'super_admin', 'registrar']), promotionController.rollbackPromotion);

export default router;
