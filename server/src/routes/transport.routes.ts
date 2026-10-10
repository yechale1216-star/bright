import { Router } from 'express';
import { TransportController } from '../controllers/transport.controller';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

// Stats
router.get('/stats', authorize(['admin', 'school_admin', 'super_admin', 'transport_manager']), TransportController.getStats);

// Vehicles
router.get('/vehicles', authorize(['admin', 'school_admin', 'super_admin', 'transport_manager']), TransportController.getVehicles);
router.post('/vehicles', authorize(['admin', 'school_admin', 'super_admin', 'transport_manager']), TransportController.createVehicle);
router.put('/vehicles/:id', authorize(['admin', 'school_admin', 'super_admin', 'transport_manager']), TransportController.updateVehicle);
router.delete('/vehicles/:id', authorize(['admin', 'school_admin', 'super_admin', 'transport_manager']), TransportController.deleteVehicle);

// Routes
router.get('/routes', TransportController.getRoutes);
router.get('/routes/:id', TransportController.getRouteById);
router.post('/routes', authorize(['admin', 'school_admin', 'transport_manager']), TransportController.createRoute);
router.put('/routes/:id', authorize(['admin', 'school_admin', 'transport_manager']), TransportController.updateRoute);
router.delete('/routes/:id', authorize(['admin', 'school_admin', 'transport_manager']), TransportController.deleteRoute);

// Student Assignments
router.get('/students/:studentId', TransportController.getStudentTransport);
router.post('/assign', authorize(['admin', 'school_admin', 'transport_manager']), TransportController.assignStudent);
router.delete('/assignments/:assignmentId', authorize(['admin', 'school_admin', 'transport_manager']), TransportController.removeStudent);

export default router;
