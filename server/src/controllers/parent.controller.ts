import { Request, Response, NextFunction } from 'express';
import * as parentService from '../services/parent.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import prisma from '../config/db';

/**
 * Helper to verify that the requested phone belongs to the authenticated user.
 */
const verifyPhoneOwnership = async (req: AuthenticatedRequest, requestedPhone: string): Promise<boolean> => {
  if (!req.user?.id) return false;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user || !user.phone) return false;

  const normalizedUserPhone = parentService.normalizePhoneNumber(user.phone);
  const normalizedRequestedPhone = parentService.normalizePhoneNumber(requestedPhone);

  return normalizedUserPhone === normalizedRequestedPhone;
};

export const listParentSchools = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: "Phone is required." });
    }
    const normalizedPhone = parentService.normalizePhoneNumber(phone);
    const result = await parentService.listParentSchools(normalizedPhone);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to list schools." });
  }
};

export const loginParent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, password, schoolId } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone and password are required." });
    }
    const normalizedPhone = parentService.normalizePhoneNumber(phone);
    const result = await parentService.loginParent(normalizedPhone, password, schoolId);
    
    if (result.success && result.token) {
      res.cookie('attendance_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to login." });
  }
};

export const searchParent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: "Phone query parameter is required." });
    }
    const result = await parentService.searchParentByPhone(phone, schoolId);
    if (!result.success) {
      return res.status(404).json({ success: false, notFound: true, message: result.message || "No parent found with this phone number." });
    }
    res.status(200).json(result);
  } catch (error: any) {
    console.error("[ParentController] searchParent error:", error);
    res.status(500).json({ success: false, error: true, message: error.message || "Internal server error searching parent." });
  }
};

export const updatePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { phone, currentPassword, newPassword } = req.body;
    if (!phone || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Phone, current password, and new password are required." });
    }

    const isOwner = await verifyPhoneOwnership(req, phone);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot modify another parent's account." });
    }

    const result = await parentService.updatePassword(phone, currentPassword, newPassword, schoolId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to update password." });
  }
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { phone } = req.params;
    const isOwner = await verifyPhoneOwnership(req, phone);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot access another parent's data." });
    }

    const notifications = await parentService.getNotifications(phone, schoolId);
    res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    next(error);
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    // Secure it: check if this notification belongs to a student of this parent (if studentId is set)
    const notification = await prisma.parentNotification.findUnique({
      where: { id }
    });
    if (notification && notification.studentId) {
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: req.user.id, studentId: notification.studentId }
      });
      if (!link) {
        return res.status(403).json({ success: false, message: "Forbidden: Notification belongs to another parent's child." });
      }
    }

    await parentService.markNotificationAsRead(id, schoolId);
    res.status(200).json({ success: true, message: "Notification marked as read." });
  } catch (error: any) {
    next(error);
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    // Secure it: check if this notification belongs to a student of this parent (if studentId is set)
    const notification = await prisma.parentNotification.findUnique({
      where: { id }
    });
    if (notification && notification.studentId) {
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const link = await prisma.parentStudentLink.findFirst({
        where: { parentId: req.user.id, studentId: notification.studentId }
      });
      if (!link) {
        return res.status(403).json({ success: false, message: "Forbidden: Notification belongs to another parent's child." });
      }
    }

    await parentService.deleteNotification(id, schoolId);
    res.status(200).json({ success: true, message: "Notification deleted." });
  } catch (error: any) {
    next(error);
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { phone } = req.params;
    const isOwner = await verifyPhoneOwnership(req, phone);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot modify another parent's data." });
    }

    await parentService.markAllNotificationsAsRead(phone, schoolId);
    res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (error: any) {
    next(error);
  }
};

export const getPreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { phone } = req.params;
    const isOwner = await verifyPhoneOwnership(req, phone);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot access another parent's preferences." });
    }

    const preferences = await parentService.getPreferences(phone, schoolId);
    res.status(200).json({ success: true, data: preferences });
  } catch (error: any) {
    next(error);
  }
};

export const updatePreferences = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { phone } = req.params;
    const isOwner = await verifyPhoneOwnership(req, phone);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot modify another parent's preferences." });
    }

    const preferences = await parentService.updatePreferences(phone, schoolId, req.body);
    res.status(200).json({ success: true, data: preferences, message: "Preferences updated successfully." });
  } catch (error: any) {
    next(error);
  }
};

export const postAnnouncement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const announcement = await parentService.postAnnouncement(schoolId, req.body);
    res.status(201).json({ success: true, data: announcement, message: "Announcement published." });
  } catch (error: any) {
    next(error);
  }
};

export const getAnnouncements = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const announcements = await parentService.getSchoolAnnouncements(schoolId);
    res.status(200).json({ success: true, data: announcements });
  } catch (error: any) {
    next(error);
  }
};

export const updateAnnouncement = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const announcement = await parentService.updateAnnouncement(id, schoolId, req.body);
    res.status(200).json({ success: true, data: announcement, message: "Announcement updated." });
  } catch (error: any) {
    next(error);
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = (req.headers['x-school-id'] as string) || req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const { phone } = req.params;
    const isOwner = await verifyPhoneOwnership(req, phone);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: You cannot modify another parent's profile." });
    }

    const { name, email, address, profile_photo } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }

    // Validate base64 image size (max ~2MB base64 ≈ 2.7M chars)
    if (profile_photo && typeof profile_photo === 'string' && profile_photo.length > 3_000_000) {
      return res.status(400).json({ success: false, message: "Photo is too large. Please use an image under 2MB." });
    }

    const result = await parentService.updateProfile(phone, schoolId, { name, email, address, profile_photo });
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to update profile." });
  }
};

/**
 * GET /api/parent/me/students?schoolId=...
 * Returns all children the parent has in the specified school.
 * schoolId comes from the x-school-id header (set during school switch).
 */
export const getMyStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Prefer explicit query param, fall back to header, then JWT schoolId
    const schoolId = (req.query.schoolId as string)
      || (req.headers['x-school-id'] as string)
      || req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'schoolId is required.' });
    }

    // Security: verify the parent actually has access to this school
    const hasAccess = await parentService.validateSchoolAccess(req.user.id, schoolId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have a child enrolled in this school.' });
    }

    const students = await parentService.getParentStudentsForSchool(req.user.id, schoolId);
    res.status(200).json({ success: true, data: students });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/parent/me/schools
 * Returns all schools this parent has children in — server validated.
 */
export const getMySchools = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const schools = await parentService.getParentSchools(req.user.id);
    res.status(200).json({ success: true, data: schools });
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /api/parent/me/active-school
 * Validates the parent owns a child in the requested school, then returns school info.
 */
export const setActiveSchool = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { schoolId } = req.body;
    if (!schoolId) return res.status(400).json({ success: false, message: 'schoolId is required.' });

    const hasAccess = await parentService.validateSchoolAccess(req.user.id, schoolId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'You do not have a child enrolled in this school.' });
    }

    // Return the school details for the frontend to update context
    const schools = await parentService.getParentSchools(req.user.id);
    const school = schools.find((s: any) => s.id === schoolId);

    // Generate a fresh token with the NEW schoolId context
    const { generateToken } = require('../utils/jwt');
    const token = generateToken({
      id: req.user.id,
      email: req.user.email,
      role: 'parent',
      schoolId: schoolId,
      customSchoolId: (school as any)?.customSchoolId || '',
    });

    // Update the attendance_token cookie to match
    res.cookie('attendance_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({ success: true, data: school, token });
  } catch (error: any) {
    next(error);
  }
};

export const checkParentsBatch = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { phones } = req.body;
    if (!Array.isArray(phones)) {
      return res.status(400).json({ success: false, message: "Phones must be an array." });
    }
    const existenceMap = await parentService.checkParentsExist(phones);
    res.status(200).json({ success: true, data: existenceMap });
  } catch (error: any) {
    next(error);
  }
};
