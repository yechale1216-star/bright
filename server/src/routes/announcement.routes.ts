import { Router } from 'express';
import * as parentController from '../controllers/parent.controller';

const router = Router();

// These routes are authenticated via tenantMiddleware
router.get('/', parentController.getAnnouncements);
router.post('/', parentController.postAnnouncement);
router.put('/:id', parentController.updateAnnouncement);
router.delete('/:id', parentController.deleteNotification);

export default router;
