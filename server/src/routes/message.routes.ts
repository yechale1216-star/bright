import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import * as groupController from '../controllers/group.controller'; // Use group controller for shared message actions
import * as bookmarkController from '../controllers/bookmark.controller';
import { featureGuard } from '../middleware/auth.middleware';

const router = Router();

router.get('/conversations/:userId', featureGuard('messaging'), messageController.getConversations);
router.get('/:conversationId/shared', featureGuard('messaging'), messageController.getConversationShared);
router.get('/:conversationId/bookmarks', featureGuard('messaging'), bookmarkController.getConversationBookmarks);
router.get('/:conversationId', featureGuard('messaging'), messageController.getMessages);
router.post('/conversations', featureGuard('messaging'), messageController.createConversation);

// Message Actions (Shared between 1:1 and Groups)
router.put('/:messageId', featureGuard('messaging'), groupController.editMessage);
router.delete('/:messageId', featureGuard('messaging'), groupController.deleteMessage);
router.post('/:messageId/pin', featureGuard('messaging'), groupController.pinMessage);
router.delete('/:messageId/pin', featureGuard('messaging'), groupController.unpinMessage);
router.post('/:messageId/react', featureGuard('messaging'), groupController.toggleReaction);
router.post('/:messageId/bookmark', featureGuard('messaging'), bookmarkController.toggleBookmark);

// ── Conversation-level Actions ─────────────────────────────────────────────────
router.get('/conversations/:id/mute', featureGuard('messaging'), messageController.getMuteStatus);
router.post('/conversations/:id/mute', featureGuard('messaging'), messageController.toggleMuteConversation);
router.post('/conversations/:id/clear', featureGuard('messaging'), messageController.clearChatHistory);
router.delete('/conversations/:id', featureGuard('messaging'), messageController.deleteConversation);

// ── Block / Unblock Actions ───────────────────────────────────────────────────
router.get('/users/:targetUserId/block-status', featureGuard('messaging'), messageController.getBlockStatus);
router.post('/users/:targetUserId/block', featureGuard('messaging'), messageController.blockUser);
router.post('/users/:targetUserId/unblock', featureGuard('messaging'), messageController.unblockUser);

export default router;
