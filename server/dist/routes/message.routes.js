"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messageController = __importStar(require("../controllers/message.controller"));
const groupController = __importStar(require("../controllers/group.controller")); // Use group controller for shared message actions
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/conversations/:userId', (0, auth_middleware_1.featureGuard)('messaging'), messageController.getConversations);
router.get('/:conversationId/shared', (0, auth_middleware_1.featureGuard)('messaging'), messageController.getConversationShared);
router.get('/:conversationId', (0, auth_middleware_1.featureGuard)('messaging'), messageController.getMessages);
router.post('/conversations', (0, auth_middleware_1.featureGuard)('messaging'), messageController.createConversation);
// Message Actions (Shared between 1:1 and Groups)
router.put('/:messageId', (0, auth_middleware_1.featureGuard)('messaging'), groupController.editMessage);
router.delete('/:messageId', (0, auth_middleware_1.featureGuard)('messaging'), groupController.deleteMessage);
router.post('/:messageId/pin', (0, auth_middleware_1.featureGuard)('messaging'), groupController.pinMessage);
router.delete('/:messageId/pin', (0, auth_middleware_1.featureGuard)('messaging'), groupController.unpinMessage);
router.post('/:messageId/react', (0, auth_middleware_1.featureGuard)('messaging'), groupController.toggleReaction);
exports.default = router;
