import { Router } from 'express';
import {
  getOrCreateSavedConversation,
  getSavedMessages,
  saveSavedMessage,
  deleteSavedMessage,
} from '../controllers/saved-messages.controller';
import { featureGuard } from '../middleware/auth.middleware';

const router = Router();

// All routes require messaging feature
router.get('/conversation', featureGuard('messaging'), getOrCreateSavedConversation);
router.get('/messages', featureGuard('messaging'), getSavedMessages);
router.post('/messages', featureGuard('messaging'), saveSavedMessage);
router.delete('/messages/:messageId', featureGuard('messaging'), deleteSavedMessage);

export default router;
