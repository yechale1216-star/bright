import { Router } from 'express';
import * as promotionController from '../controllers/promotion.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Only school admins/admins can perform promotions
router.get('/preview', authorize(['admin', 'school_admin']), promotionController.getPromotionPreview);
router.get('/preview/:gradeId/students', authorize(['admin', 'school_admin']), promotionController.getStudentsByGrade);
router.post('/promote', authorize(['admin', 'school_admin']), promotionController.promoteStudents);
router.get('/history', authorize(['admin', 'school_admin']), promotionController.getPromotionHistory);
router.post('/rollback/:id', authorize(['admin', 'school_admin']), promotionController.rollbackPromotion);

export default router;
