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
const crypto_1 = __importDefault(require("crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const userService = __importStar(require("../services/user.service"));
const schoolService = __importStar(require("../services/school.service"));
const jwt_1 = require("../utils/jwt");
const db_1 = __importDefault(require("../config/db"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Rate limiters — applied per IP to prevent brute force and credential stuffing
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute window
    max: 10, // Max 10 login attempts per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in a minute.' },
    skip: () => process.env.NODE_ENV === 'test',
});
const forgotPasswordLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute window
    max: 3, // Max 3 password reset emails per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many password reset requests. Please try again in a minute.' },
    skip: () => process.env.NODE_ENV === 'test',
});
const checkEmailLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests.' },
    skip: () => process.env.NODE_ENV === 'test',
});
// Rate limiter for phone/email check — prevents user enumeration probing
const checkPhoneLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests.' },
    skip: () => process.env.NODE_ENV === 'test',
});
// Strict limiter for OTP endpoints (verify-email, resend-verification)
const otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many verification attempts. Please wait 15 minutes.' },
    skip: () => process.env.NODE_ENV === 'test',
});
// Push token limiter — prevents FCM token flooding
const pushTokenLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests.' },
    skip: () => process.env.NODE_ENV === 'test',
});
const router = (0, express_1.Router)();
// Check email availability
router.get('/check-email', checkEmailLimiter, async (req, res, next) => {
    try {
        const { email } = req.query;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const existing = await db_1.default.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        res.status(200).json({ success: true, available: !existing });
    }
    catch (error) {
        next(error);
    }
});
// Check phone availability
router.get('/check-phone', checkPhoneLimiter, async (req, res, next) => {
    try {
        const { phone } = req.query;
        if (!phone || typeof phone !== 'string') {
            return res.status(400).json({ success: false, message: 'Phone is required' });
        }
        const existing = await db_1.default.user.findFirst({ where: { phone: phone.trim() } });
        res.status(200).json({ success: true, available: !existing });
    }
    catch (error) {
        next(error);
    }
});
// Login
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const user = await userService.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const valid = userService.verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // Resolve single school context
        const singleSchool = await schoolService.getSingleSchool();
        let schoolId = singleSchool.id;
        let customSchoolId = singleSchool.schoolId || 'SCH-0001';
        let schoolName = singleSchool.name || 'Addis Hiwot School';
        let schoolLogo = singleSchool.settings?.school_logo || '';
        const token = (0, jwt_1.generateToken)({
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: schoolId,
            customSchoolId: customSchoolId,
        });
        res.cookie('attendance_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        const singleSchoolObj = {
            id: schoolId,
            name: schoolName,
            logo: schoolLogo,
            customSchoolId: customSchoolId,
            role: user.role
        };
        res.status(200).json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.full_name,
                    role: user.role,
                    schoolId: schoolId,
                    customSchoolId: customSchoolId,
                },
                schoolName,
                schoolLogo,
                onboardingCompleted: true,
                availableSchools: [singleSchoolObj],
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Logout
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.attendance_token || req.headers.authorization?.split(' ')[1];
        if (token) {
            let decoded = null;
            try {
                decoded = (0, jwt_1.verifyToken)(token);
            }
            catch (err) {
                // Safe fallback: decode token anyway without verifying expiration to clear target pushToken
                console.warn('[Logout] Token verification failed (possibly expired), decoding to clear pushToken', err);
                decoded = jsonwebtoken_1.default.decode(token);
            }
            if (decoded && decoded.id) {
                await db_1.default.user.update({
                    where: { id: decoded.id },
                    data: { pushToken: null }
                });
            }
        }
    }
    catch (err) {
        console.error('[Logout] Failed to clear user pushToken:', err);
    }
    res.clearCookie('attendance_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
});
router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        await userService.createPasswordResetToken(email);
        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, password reset instructions will be processed.'
        });
    }
    catch (error) {
        next(error);
    }
});
// Verify Reset Token
router.get('/verify-reset-token', async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }
        const user = await userService.getUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ success: false, valid: false, message: 'Invalid or expired token' });
        }
        res.status(200).json({ success: true, valid: true, email: user.email });
    }
    catch (error) {
        next(error);
    }
});
// Reset Password
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token and password are required' });
        }
        await userService.resetPasswordByToken(token, password);
        res.status(200).json({
            success: true,
            message: 'Password successfully reset. You can now login with your new password.'
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to reset password' });
    }
});
// Change / Update Password (authenticated user changes their own password)
router.post(['/change-password', '/update-password'], async (req, res, next) => {
    try {
        // Resolve user from JWT (cookie or Authorization header)
        const rawToken = req.cookies?.attendance_token || req.headers.authorization?.split(' ')[1];
        if (!rawToken) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const { verifyToken } = require('../utils/jwt');
        const decoded = verifyToken(rawToken);
        if (!decoded || !decoded.id) {
            return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
        }
        await userService.changePassword(decoded.id, currentPassword, newPassword);
        res.status(200).json({ success: true, message: 'Password updated successfully.' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update password.' });
    }
});
// POST /api/auth/push-token — save or refresh the FCM push token for the authenticated user
// Called by NativeBridge every time the app starts or the FCM token rotates.
router.post('/push-token', pushTokenLimiter, async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ success: false, message: 'token is required' });
        }
        // Resolve authenticated user from cookie or Authorization header
        const rawToken = req.cookies?.attendance_token || req.headers.authorization?.split(' ')[1];
        if (!rawToken) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const decoded = (0, jwt_1.verifyToken)(rawToken);
        if (!decoded || !decoded.id) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        // Prevent duplicate: set pushToken to null for any other user holding this token
        await db_1.default.user.updateMany({
            where: { pushToken: token, id: { not: decoded.id } },
            data: { pushToken: null }
        });
        await db_1.default.user.update({
            where: { id: decoded.id },
            data: { pushToken: token },
        });
        res.status(200).json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// Verify Email (6-digit code)
router.post('/verify-email', otpLimiter, async (req, res, next) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ success: false, message: 'Email and verification code are required' });
        }
        const user = await db_1.default.user.findFirst({
            where: {
                email: email.toLowerCase().trim(),
                verification_token: code.trim(),
                verification_token_expires: { gt: new Date() }
            }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code. Please request a new one.' });
        }
        await db_1.default.user.update({
            where: { id: user.id },
            data: {
                is_verified: true,
                verification_token: null,
                verification_token_expires: null
            }
        });
        res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now continue with onboarding.',
            data: { isVerified: true }
        });
    }
    catch (error) {
        next(error);
    }
});
// Resend Verification Code
router.post('/resend-verification', otpLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const user = await db_1.default.user.findUnique({
            where: { email: email.toLowerCase().trim() }
        });
        // Always return success to prevent email enumeration
        if (!user || user.is_verified) {
            return res.status(200).json({
                success: true,
                message: 'If an unverified account exists with that email, a new code has been sent.'
            });
        }
        const verificationCode = crypto_1.default.randomInt(100000, 999999).toString();
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db_1.default.user.update({
            where: { id: user.id },
            data: {
                verification_token: verificationCode,
                verification_token_expires: verificationExpires
            }
        });
        res.status(200).json({
            success: true,
            message: 'If an unverified account exists with that email, a new code has been generated.'
        });
    }
    catch (error) {
        next(error);
    }
});
// Health-check route for email service (Resend / SMTP removed)
router.get('/email-health', async (_req, res) => {
    res.status(200).json({
        success: true,
        provider: 'none',
        configured: false,
        message: 'Email infrastructure has been removed. Awaiting new email delivery configuration.',
    });
});
exports.default = router;
