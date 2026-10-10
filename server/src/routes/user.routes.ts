import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import * as userService from '../services/user.service';
import { AuthenticatedRequest, authorize } from '../middleware/auth.middleware';
import * as settingsService from '../services/settings.service';
import { validatePassword, PASSWORD_REQUIREMENTS_MESSAGE } from '../utils/password-validator';

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in a minute.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const router = Router();

// Get current user profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const user = await userService.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const settings = await settingsService.getSettings();

    const contextUser = {
      ...user,
      role: req.user?.role || user.role,
      isVerified: (user as any).is_verified ?? false,
      schoolId: 'single-school',
      customSchoolId: 'SCH-0001',
      schoolName: settings?.school_name || 'Bright Path',
      schoolLogo: settings?.school_logo || '',
      onboardingCompleted: true
    };
    
    res.status(200).json({ success: true, data: contextUser });
  } catch (error) { next(error); }
});

// Get user by email — used by auth login
router.get('/by-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const user = await userService.getUserByEmail(email as string);
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
});

// Get all users (teachers & staff)
router.get('/', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const users = await userService.getUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) { next(error); }
});

// Get all contacts
router.get('/contacts', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const contacts = await userService.getContacts(undefined, req.user);
    res.status(200).json({ success: true, data: contacts });
  } catch (error) { next(error); }
});

// Create user (Admin only)
router.post('/', authorize(['admin', 'school_admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = { ...req.body };
    const user = await userService.createUser(data);
    res.status(201).json({ success: true, data: user });
  } catch (error) { next(error); }
});

// Update user (Admin or Self)
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const requestingUserRole = req.user?.role;
    const requestingUserId = req.user?.id;
    const targetUserId = req.params.id;

    if (!requestingUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const isAdmin = requestingUserRole === 'admin' || requestingUserRole === 'school_admin' || requestingUserRole === 'super_admin';

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
      delete updateData.attendanceMode;
      delete updateData.attendance_mode;
    }

    const user = await userService.updateUser(targetUserId, updateData);
    res.status(200).json({ success: true, data: user });
  } catch (error) { next(error); }
});

// Change / Update Password for authenticated user
router.post(['/change-password', '/update-password'], async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    const pv = validatePassword(newPassword);
    if (!pv.isValid) {
      return res.status(400).json({ success: false, message: pv.error || PASSWORD_REQUIREMENTS_MESSAGE });
    }

    await userService.changePassword(userId, currentPassword, newPassword);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update password' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authorize(['admin', 'school_admin', 'super_admin']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) { next(error); }
});

// Verify password
router.post('/verify-password', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, valid: false, message: 'Email and password are required' });
    }
    const user = await userService.getUserByEmailWithPassword(email);
    if (!user) return res.status(200).json({ success: true, valid: false });
    const valid = userService.verifyPassword(password, user.password_hash);
    res.status(200).json({ success: true, valid });
  } catch (error) { next(error); }
});

// Get schools (returns single school for compatibility)
router.get('/me/schools', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { getMemberships } = require('../services/auth_resolution.service');
    const schools = await getMemberships(req.user.id);
    res.status(200).json({ success: true, data: schools });
  } catch (error) { next(error); }
});

// Active school context (noop in single school)
router.post('/me/active-school', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { getMemberships } = require('../services/auth_resolution.service');
    const memberships = await getMemberships(req.user.id);
    const school = memberships[0] || { id: 'single-school', name: 'Bright Path' };
    
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
  } catch (error) { next(error); }
});

export default router;

