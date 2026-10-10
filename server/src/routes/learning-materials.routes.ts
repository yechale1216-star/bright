import { Router } from 'express';
import * as materialsController from '../controllers/learning-materials.controller';

const router = Router();

// ─── Teacher/Admin: Learning Materials CRUD ───────────────────────────────────
router.get('/', materialsController.getMaterials);
router.get('/:id', materialsController.getMaterialById);
router.post('/', materialsController.createMaterial);
router.put('/:id', materialsController.updateMaterial);
router.delete('/:id', materialsController.deleteMaterial);

// ─── Student Portal ───────────────────────────────────────────────────────────
router.get('/student/:studentId', materialsController.getStudentMaterials);

export default router;
