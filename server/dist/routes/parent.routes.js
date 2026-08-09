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
const parentController = __importStar(require("../controllers/parent.controller"));
const router = (0, express_1.Router)();
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
exports.default = router;
