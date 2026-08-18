import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as staffAttendanceService from '../services/staff-attendance.service';

export const checkIn = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    if (!schoolId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await staffAttendanceService.checkIn(userId, schoolId, req.body);
    res.status(200).json({ success: true, data: result, message: 'Staff check-in recorded successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to record check-in' });
  }
};

export const checkOut = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    if (!schoolId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await staffAttendanceService.checkOut(userId, schoolId, req.body);
    res.status(200).json({ success: true, data: result, message: 'Staff check-out recorded successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to record check-out' });
  }
};

export const getMyAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    if (!schoolId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await staffAttendanceService.getMyAttendance(userId, schoolId, req.query as any);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const getStaffAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School context required' });
    }

    const result = await staffAttendanceService.getStaffAttendance(schoolId, req.query as any);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const enrollFace = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const adminUserId = req.user?.id;
    if (!schoolId || !adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userId, descriptor } = req.body;
    if (!userId || !descriptor) {
      return res.status(400).json({ success: false, message: 'Target userId and descriptor are required' });
    }

    const result = await staffAttendanceService.enrollFace(adminUserId, userId, schoolId, descriptor);
    res.status(200).json({ success: true, data: result, message: 'Staff face enrolled successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to enroll face' });
  }
};

export const getEnrolledDescriptor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School context required' });
    }

    const targetUserId = req.params.userId || req.user?.id;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Only admin or the staff member themselves can fetch their descriptor
    if (req.user?.role !== 'admin' && req.user?.role !== 'school_admin' && req.user?.id !== targetUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await staffAttendanceService.getEnrolledDescriptor(targetUserId, schoolId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const bulkSync = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!schoolId || !userId) {
      return res.status(401).json({ success: false, message: 'School context required' });
    }

    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Records array is required' });
    }

    // Non-admin staff can only sync their own records
    const isAdmin = role === 'admin' || role === 'school_admin';
    const filteredRecords = isAdmin
      ? records
      : records.filter((r: any) => r.userId === userId);

    if (!isAdmin && filteredRecords.length < records.length) {
      // Log the attempt but don't fail — just silently drop foreign records
      console.warn(`[BulkSync] User ${userId} tried to sync ${records.length - filteredRecords.length} records belonging to other users. Records dropped.`);
    }

    const result = await staffAttendanceService.bulkSyncStaffAttendance(filteredRecords, schoolId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Bulk sync failed' });
  }
};

export const markAbsent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const adminUserId = req.user?.id;
    if (!schoolId || !adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userIds, date, remarks } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || !date) {
      return res.status(400).json({ success: false, message: 'userIds array and date are required' });
    }

    const result = await staffAttendanceService.markAbsentStaff(adminUserId, schoolId, userIds, date, remarks);
    res.status(200).json({ success: true, data: result, message: `Marked ${result.length} staff as absent` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to mark absent' });
  }
};

export const getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School context required' });
    }

    const { date } = req.query;
    const result = await staffAttendanceService.getStaffAttendanceStats(schoolId, date as string);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const getReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School context required' });
    }

    const { startDate, endDate, role, userId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const result = await staffAttendanceService.getStaffAttendanceReport(schoolId, {
      startDate: startDate as string,
      endDate: endDate as string,
      role: role as string,
      userId: userId as string,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const correctRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const adminUserId = req.user?.id;
    if (!schoolId || !adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Record ID is required' });
    }

    const result = await staffAttendanceService.correctAttendance(adminUserId, id, schoolId, req.body);
    res.status(200).json({ success: true, data: result, message: 'Attendance record updated with audit trail.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to correct attendance record' });
  }
};

export const setLeave = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    const adminUserId = req.user?.id;
    if (!schoolId || !adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userId, date, status, reason } = req.body;
    if (!userId || !date || !status || !reason) {
      return res.status(400).json({ success: false, message: 'userId, date, status (LEAVE | PERMISSION), and reason are required' });
    }

    const result = await staffAttendanceService.setLeaveOrPermission(adminUserId, userId, schoolId, { date, status, reason });
    res.status(200).json({ success: true, data: result, message: `Staff marked as ${status}` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to set leave/permission' });
  }
};

