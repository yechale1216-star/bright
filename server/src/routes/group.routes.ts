import { Router } from 'express';
import * as groupController from '../controllers/group.controller';
import { featureGuard } from '../middleware/auth.middleware';

const router = Router();

// Group CRUD
router.post('/', featureGuard('messaging'), groupController.createGroup);
router.get('/:id', featureGuard('messaging'), groupController.getGroup);
router.put('/:id', featureGuard('messaging'), groupController.updateGroup);
router.delete('/:id', featureGuard('messaging'), groupController.deleteGroup);

// Member Management
router.post('/:id/members', featureGuard('messaging'), groupController.addMembers);
router.delete('/:id/members/:userId', featureGuard('messaging'), groupController.removeMember);
router.put('/:id/members/:userId/role', featureGuard('messaging'), groupController.updateMemberRole);

// Mute Settings
router.post('/:id/mute', featureGuard('messaging'), groupController.toggleMute);

// Group Media
router.get('/:id/media', featureGuard('messaging'), groupController.getGroupMedia);

export default router;
