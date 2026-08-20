import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import * as userService from '../services/user.service';
import * as schoolService from '../services/school.service';
import { getMemberships } from '../services/auth_resolution.service';
import { generateToken, verifyToken } from '../utils/jwt';
import { sendResetPasswordEmail, sendVerificationEmail } from '../utils/email';
import { validateSignup } from '../middleware/validate';
import prisma from '../config/db';
import jwt from 'jsonwebtoken';

// Rate limiters — applied per IP to prevent brute force and credential stuffing
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 10,                  // Max 10 login attempts per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again in a minute.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 3,                   // Max 3 password reset emails per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests. Please try again in a minute.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const checkEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Rate limiter for phone/email check — prevents user enumeration probing
const checkPhoneLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Strict limiter for OTP endpoints (verify-email, resend-verification)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please wait 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Push token limiter — prevents FCM token flooding
const pushTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
  skip: () => process.env.NODE_ENV === 'test',
});


const router = Router();

// Check email availability
router.get('/check-email', checkEmailLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    res.status(200).json({ success: true, available: !existing });
  } catch (error) {
    next(error);
  }
});

// Check phone availability
router.get('/check-phone', checkPhoneLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }
    const existing = await prisma.user.findFirst({ where: { phone: phone.trim() } });
    res.status(200).json({ success: true, available: !existing });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
    let schoolLogo = (singleSchool as any).settings?.school_logo || '';

    const token = generateToken({
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
  } catch (error) {
    next(error);
  }
});



// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.attendance_token || req.headers.authorization?.split(' ')[1];
    if (token) {
      let decoded: any = null;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        // Safe fallback: decode token anyway without verifying expiration to clear target pushToken
        console.warn('[Logout] Token verification failed (possibly expired), decoding to clear pushToken', err);
        decoded = jwt.decode(token);
      }
      if (decoded && decoded.id) {
        await prisma.user.update({
          where: { id: decoded.id },
          data: { pushToken: null }
        });
      }
    }
  } catch (err) {
    console.error('[Logout] Failed to clear user pushToken:', err);
  }

  res.clearCookie('attendance_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

router.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const token = await userService.createPasswordResetToken(email);
    
    // We send success even if user not found for security (prevent email enumeration)
    if (token) {
      await sendResetPasswordEmail(email, token);
    }

    res.status(200).json({ 
      success: true, 
      message: 'If an account with that email exists, we have sent password reset instructions.' 
    });
  } catch (error) {
    next(error);
  }
});

// Verify Reset Token
router.get('/verify-reset-token', async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    next(error);
  }
});

// Reset Password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to reset password' });
  }
});

// POST /api/auth/push-token — save or refresh the FCM push token for the authenticated user
// Called by NativeBridge every time the app starts or the FCM token rotates.
router.post('/push-token', pushTokenLimiter, async (req: Request, res: Response, next: NextFunction) => {
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

    const decoded = verifyToken(rawToken);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Prevent duplicate: set pushToken to null for any other user holding this token
    await prisma.user.updateMany({
      where: { pushToken: token, id: { not: decoded.id } },
      data: { pushToken: null }
    });

    await prisma.user.update({
      where: { id: decoded.id },
      data: { pushToken: token },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Verify Email (6-digit code)
router.post('/verify-email', otpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        verification_token: code.trim(),
        verification_token_expires: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code. Please request a new one.' });
    }

    await prisma.user.update({
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
  } catch (error) {
    next(error);
  }
});

// Resend Verification Code
router.post('/resend-verification', otpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    // Always return success to prevent email enumeration
    if (!user || user.is_verified) {
      return res.status(200).json({
        success: true,
        message: 'If an unverified account exists with that email, a new code has been sent.'
      });
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verification_token: verificationCode,
        verification_token_expires: verificationExpires
      }
    });

    await sendVerificationEmail(user.email, verificationCode);

    res.status(200).json({
      success: true,
      message: 'If an unverified account exists with that email, a new code has been sent.'
    });
  } catch (error) {
    next(error);
  }
});

// Health-check route for email service
router.get('/email-health', async (_req: Request, res: Response) => {
  const hasSmtp = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const hasApiKey = !!process.env.RESEND_API_KEY;
  res.status(200).json({
    success: true,
    provider: hasSmtp ? 'smtp' : (hasApiKey ? 'resend' : 'none'),
    configured: hasSmtp || hasApiKey,
    message: hasSmtp 
      ? `SMTP is configured for ${process.env.EMAIL_USER}` 
      : (hasApiKey ? 'Resend API key is configured.' : 'Neither SMTP nor Resend is configured.'),
  });
});

export default router;
