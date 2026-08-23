import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as staffAttendanceService from '../services/staff-attendance.service';

export const checkIn = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await staffAttendanceService.checkIn(userId, undefined, req.body);
    res.status(200).json({ success: true, data: result, message: 'Staff check-in recorded successfully' });
  } catch (error: any) {
    if (error.code === 'NON_WORKING_DAY') {
      return res.status(403).json({
        success: false,
        code: 'NON_WORKING_DAY',
        displayReason: error.displayReason,
        isHoliday: error.isHoliday,
        isWeekend: error.isWeekend,
        message: error.message,
      });
    }
    res.status(400).json({ success: false, message: error.message || 'Failed to record check-in' });
  }
};

export const checkOut = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await staffAttendanceService.checkOut(userId, undefined, req.body);
    res.status(200).json({ success: true, data: result, message: 'Staff check-out recorded successfully' });
  } catch (error: any) {
    if (error.code === 'NON_WORKING_DAY') {
      return res.status(403).json({
        success: false,
        code: 'NON_WORKING_DAY',
        displayReason: error.displayReason,
        isHoliday: error.isHoliday,
        isWeekend: error.isWeekend,
        message: error.message,
      });
    }
    res.status(400).json({ success: false, message: error.message || 'Failed to record check-out' });
  }
};

export const getMyAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const result = await staffAttendanceService.getMyAttendance(userId, undefined, req.query as any);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const getStaffAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await staffAttendanceService.getStaffAttendance(undefined, req.query as any);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const enrollFace = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const callerUserId = req.user?.id;
    const role = req.user?.role;
    if (!callerUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userId, descriptor, replaceExisting } = req.body;
    const targetUserId = userId || callerUserId;

    const isAdmin = role === 'admin' || role === 'school_admin';
    if (!isAdmin && callerUserId !== targetUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Staff can only enroll their own face template.' });
    }

    if (!targetUserId || !descriptor) {
      return res.status(400).json({ success: false, message: 'Target userId and descriptor are required' });
    }

    const result = await staffAttendanceService.enrollFace(
      callerUserId,
      targetUserId,
      undefined,
      descriptor,
      Boolean(replaceExisting)
    );
    res.status(200).json({ success: true, data: result, message: 'Staff face biometric template registered successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to enroll face' });
  }
};

export const getEnrolledDescriptor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.userId || req.user?.id;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (req.user?.role !== 'admin' && req.user?.role !== 'school_admin' && req.user?.id !== targetUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await staffAttendanceService.getEnrolledDescriptor(targetUserId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const bulkSync = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Records array is required' });
    }

    const isAdmin = role === 'admin' || role === 'school_admin';
    const filteredRecords = isAdmin
      ? records
      : records.filter((r: any) => r.userId === userId);

    const result = await staffAttendanceService.bulkSyncStaffAttendance(filteredRecords);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Bulk sync failed' });
  }
};

export const markAbsent = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const adminUserId = req.user?.id;
    if (!adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userIds, date, remarks, session } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || !date) {
      return res.status(400).json({ success: false, message: 'userIds array and date are required' });
    }

    const result = await staffAttendanceService.markAbsentStaff(adminUserId, undefined, userIds, date, remarks, session);
    res.status(200).json({ success: true, data: result, message: `Marked ${result.length} staff as absent` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to mark absent' });
  }
};

export const getStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { date, session } = req.query;
    const result = await staffAttendanceService.getStaffAttendanceStats(undefined, date as string, session as string);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const getReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, role, userId, mode, session } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const result = await staffAttendanceService.getStaffAttendanceReport(undefined, {
      startDate: startDate as string,
      endDate: endDate as string,
      role: role as string,
      userId: userId as string,
      mode: mode as string,
      session: session as string,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
};

export const correctRecord = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const adminUserId = req.user?.id;
    if (!adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Record ID is required' });
    }

    const result = await staffAttendanceService.correctAttendance(adminUserId, id, undefined, req.body);
    res.status(200).json({ success: true, data: result, message: 'Attendance record updated with audit trail.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to correct attendance record' });
  }
};

export const setLeave = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const adminUserId = req.user?.id;
    if (!adminUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userId, date, status, reason, session, mode } = req.body;
    if (!userId || !date || !status || !reason) {
      return res.status(400).json({ success: false, message: 'userId, date, status (LEAVE | PERMISSION), and reason are required' });
    }

    const result = await staffAttendanceService.setLeaveOrPermission(adminUserId, userId, undefined, { date, status, reason, session, mode });
    res.status(200).json({ success: true, data: result, message: `Staff marked as ${status}` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to set leave/permission' });
  }
};

export const processAbsences = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const { date, session, force } = req.body || {};
    const result = await staffAttendanceService.processAutomaticStaffAbsences({
      date,
      session,
      force: !!force,
    });
    res.status(200).json({ success: true, data: result, message: 'Staff automatic absence evaluation completed.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to process automatic absences' });
  }
};
