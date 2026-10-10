import { Response, NextFunction } from 'express';
import * as attendanceService from '../services/attendance.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const markAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payload = {
      ...req.body,
      userRole: req.user?.role,
      userId: req.user?.id,
      teacherId: req.body.teacherId || (req.user as any)?.teacherId || req.user?.id,
    };
    const result = await attendanceService.markAttendance(payload);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const filters = {
      ...req.query
    };
    const result = await attendanceService.getAttendance(filters);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceByStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const result = await attendanceService.getAttendanceByStudent(req.params.studentId, undefined, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const bulkMarkAttendance = async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  try {
    const { records, latitude, longitude, locationVerified, locationDistance } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Records must be an array' });
    }

    const results = await attendanceService.bulkMarkAttendance(records, undefined, {
      userRole: req.user?.role,
      userId: req.user?.id,
      teacherId: (req.user as any)?.teacherId || req.user?.id,
      latitude,
      longitude,
      locationVerified,
      locationDistance,
    });

    res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to mark attendance' });
  }
};

export const createEditRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const teacherId = (req.user as any)?.teacherId || req.user?.id;
    const result = await attendanceService.createEditRequest(undefined, teacherId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getEditRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filters = {
      ...req.query,
      ...(req.user?.role === 'teacher' ? { teacherId: (req.user as any)?.teacherId || req.user?.id } : {})
    };
    const result = await attendanceService.getEditRequests(undefined, filters);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const approveEditRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const approverRoles = ['admin', 'school_admin', 'super_admin', 'academic_head'];
    if (!approverRoles.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Only authorized administrators can approve edit requests' });
    }
    const result = await attendanceService.approveEditRequest(
      req.params.id,
      req.user?.id || 'admin',
      undefined,
      req.body.adminNote
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const rejectEditRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const approverRoles = ['admin', 'school_admin', 'super_admin', 'academic_head'];
    if (!approverRoles.includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Only authorized administrators can reject edit requests' });
    }
    const result = await attendanceService.rejectEditRequest(
      req.params.id,
      req.user?.id || 'admin',
      undefined,
      req.body.adminNote
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await attendanceService.getAttendanceAuditLogs();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/dashboard-summary
 * Lightweight dashboard summary: student count, today's attendance totals, 14-day trend.
 * Uses DB-side aggregation — never loads all rows into memory.
 */
export const getDashboardSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await attendanceService.getDashboardSummary(req.query as any);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

