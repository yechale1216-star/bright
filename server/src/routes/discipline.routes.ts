import { Router } from 'express';
import { authMiddleware, authorize } from '../middleware/auth.middleware';
import { DisciplineController } from '../controllers/discipline.controller';

const router = Router();

// Apply tenant authentication to all discipline routes
router.use(authMiddleware);

// Categories Configuration
router.get('/categories', DisciplineController.getCategories);
router.post('/categories', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.createCategory);
router.delete('/categories/:id', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.deleteCategory);

// Disciplinary Actions Configuration
router.get('/actions-config', DisciplineController.getActionsConfig);
router.post('/actions-config', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.createActionConfig);
router.delete('/actions-config/:id', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.deleteActionConfig);

// Analytics Dashboard
router.get('/analytics', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.getAnalytics);

// Student Discipline Profile & Chronological Case History
router.get('/student/:studentId', DisciplineController.getStudentProfile);

// Incidents List & Core CRUD
router.get('/', DisciplineController.getIncidents);
router.get('/:id', DisciplineController.getIncidentById);
router.post('/', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.createIncident);
router.put('/:id', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.updateIncident);
router.delete('/:id', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.deleteIncident);

// Workflow Management (Officer Assignment, Investigation, Actions)
router.post('/:id/assign', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.assignOfficer);
router.put('/:id/investigation', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.updateInvestigation);
router.put('/:id/action', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.updateAction);

// Follow-ups & Parent Acknowledgment
router.post('/:id/follow-up', authorize(['admin', 'school_admin', 'discipline_officer']), DisciplineController.addFollowUp);
router.post('/:id/acknowledge', authorize(['parent']), DisciplineController.acknowledgeIncident);

export default router;
