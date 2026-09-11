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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const userService = __importStar(require("../services/user.service"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const settingsService = __importStar(require("../services/settings.service"));
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again in a minute.' },
    skip: () => process.env.NODE_ENV === 'test',
});
const router = (0, express_1.Router)();
// Get current user profile
router.get('/profile', async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const user = await userService.getUserById(userId);
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });
        const settings = await settingsService.getSettings();
        const contextUser = {
            ...user,
            role: req.user?.role || user.role,
            isVerified: user.is_verified ?? false,
            schoolId: 'single-school',
            customSchoolId: 'SCH-0001',
            schoolName: settings?.school_name || 'Addis Hiwot School',
            schoolLogo: settings?.school_logo || '',
            onboardingCompleted: true
        };
        res.status(200).json({ success: true, data: contextUser });
    }
    catch (error) {
        next(error);
    }
});
// Get user by email — used by auth login
router.get('/by-email', async (req, res, next) => {
    try {
        const { email } = req.query;
        if (!email)
            return res.status(400).json({ success: false, message: 'Email required' });
        const user = await userService.getUserByEmail(email);
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
// Get all users (teachers & staff)
router.get('/', async (_req, res, next) => {
    try {
        const users = await userService.getUsers();
        res.status(200).json({ success: true, data: users });
    }
    catch (error) {
        next(error);
    }
});
// Get all contacts
router.get('/contacts', async (req, res, next) => {
    try {
        const contacts = await userService.getContacts(undefined, req.user);
        res.status(200).json({ success: true, data: contacts });
    }
    catch (error) {
        next(error);
    }
});
// Create user (Admin only)
router.post('/', (0, auth_middleware_1.authorize)(['admin', 'school_admin']), async (req, res, next) => {
    try {
        const data = { ...req.body };
        const user = await userService.createUser(data);
        res.status(201).json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
// Update user (Admin or Self)
router.put('/:id', async (req, res, next) => {
    try {
        const requestingUserRole = req.user?.role;
        const requestingUserId = req.user?.id;
        const targetUserId = req.params.id;
        if (!requestingUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const isAdmin = requestingUserRole === 'admin' || requestingUserRole === 'school_admin';
        // Non-admins can only update themselves
        if (!isAdmin && requestingUserId !== targetUserId) {
            return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify another user\'s profile' });
        }
        const updateData = { ...req.body };
        // Non-admins cannot update privilege-escalating fields
        if (!isAdmin) {
            delete updateData.role;
            delete updateData.is_active;
            delete updateData.teacher_id;
        }
        const user = await userService.updateUser(targetUserId, updateData);
        res.status(200).json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
// Change / Update Password for authenticated user
router.post(['/change-password', '/update-password'], async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const { currentPassword, newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({ success: false, message: 'New password is required' });
        }
        await userService.changePassword(userId, currentPassword, newPassword);
        res.status(200).json({ success: true, message: 'Password updated successfully' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to update password' });
    }
});
// Delete user (Admin only)
router.delete('/:id', (0, auth_middleware_1.authorize)(['admin', 'school_admin']), async (req, res, next) => {
    try {
        await userService.deleteUser(req.params.id);
        res.status(200).json({ success: true, message: 'User deleted' });
    }
    catch (error) {
        next(error);
    }
});
// Verify password
router.post('/verify-password', loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, valid: false, message: 'Email and password are required' });
        }
        const user = await userService.getUserByEmail(email);
        if (!user)
            return res.status(200).json({ success: true, valid: false });
        const valid = userService.verifyPassword(password, user.password_hash);
        res.status(200).json({ success: true, valid });
    }
    catch (error) {
        next(error);
    }
});
// Get schools (returns single school for compatibility)
router.get('/me/schools', async (req, res, next) => {
    try {
        if (!req.user?.id)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { getMemberships } = require('../services/auth_resolution.service');
        const schools = await getMemberships(req.user.id);
        res.status(200).json({ success: true, data: schools });
    }
    catch (error) {
        next(error);
    }
});
// Active school context (noop in single school)
router.post('/me/active-school', async (req, res, next) => {
    try {
        if (!req.user?.id)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { getMemberships } = require('../services/auth_resolution.service');
        const memberships = await getMemberships(req.user.id);
        const school = memberships[0] || { id: 'single-school', name: 'Addis Hiwot School' };
        const { generateToken } = require('../utils/jwt');
        const token = generateToken({
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
        });
        res.cookie('attendance_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.status(200).json({ success: true, data: school, token });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
