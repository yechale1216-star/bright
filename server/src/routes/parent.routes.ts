import { Router } from 'express';
import * as parentController from '../controllers/parent.controller';

const router = Router();

// Authentication / Verification
router.get('/schools', parentController.listParentSchools);
router.post('/login', parentController.loginParent);
router.post('/update-password', parentController.updatePassword);
router.get('/search', parentController.searchParent);
router.post('/check-batch', parentController.checkParentsBatch);

// Notifications & Announcements
router.get('/notifications/:phone', parentController.getNotifications);
router.patch('/notifications/:id/read', parentController.markAsRead);
router.delete('/notifications/:id', parentController.deleteNotification);
router.patch('/notifications/read-all/:phone', parentController.markAllAsRead);

// Preferences
router.get('/preferences/:phone', parentController.getPreferences);
router.put('/preferences/:phone', parentController.updatePreferences);

// Profile
router.put('/profile/:phone', parentController.updateProfile);

// School context — authenticated, server-validated
router.get('/me/schools', parentController.getMySchools);
router.get('/me/students', parentController.getMyStudents);

export default router;
