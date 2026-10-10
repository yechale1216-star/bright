import { Router } from 'express';
import * as ctrl from '../controllers/assessment-policy.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

const POLICY_ADMINS = ['admin', 'school_admin', 'super_admin', 'academic_head'];

// ─── Assessment Types ──────────────────────────────────────────────────────
router.get('/types', ctrl.getAssessmentTypes);
router.post('/types/seed', authorize(POLICY_ADMINS), ctrl.seedAssessmentTypes);
router.post('/types', authorize(POLICY_ADMINS), ctrl.createAssessmentType);
router.put('/types/:id', authorize(POLICY_ADMINS), ctrl.updateAssessmentType);
router.delete('/types/:id', authorize(POLICY_ADMINS), ctrl.deleteAssessmentType);

// ─── Schemes ──────────────────────────────────────────────────────────────
router.get('/schemes', ctrl.getSchemes);
router.get('/schemes/resolve', ctrl.resolveSchemeForContext);
router.get('/schemes/ensure-default', ctrl.ensureDefaultScheme);
router.get('/schemes/:id', ctrl.getSchemeById);
router.post('/schemes', authorize(POLICY_ADMINS), ctrl.createScheme);
router.post('/schemes/:id/duplicate', authorize(POLICY_ADMINS), ctrl.duplicateScheme);
router.put('/schemes/:id', authorize(POLICY_ADMINS), ctrl.updateScheme);
router.delete('/schemes/:id', authorize(POLICY_ADMINS), ctrl.deleteScheme);

// ─── Bulk Template Assignment ─────────────────────────────────────────────
router.post('/bulk-assign/preview', authorize(POLICY_ADMINS), ctrl.previewBulkAssignment);
router.post('/bulk-assign/apply', authorize(POLICY_ADMINS), ctrl.executeBulkAssignment);

// ─── Scheme Assignments ────────────────────────────────────────────────────
router.post('/assignments', authorize(POLICY_ADMINS), ctrl.assignScheme);
router.delete('/assignments/:id', authorize(POLICY_ADMINS), ctrl.deleteSchemeAssignment);

export default router;

