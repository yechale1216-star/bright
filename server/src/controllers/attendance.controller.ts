import { Response, NextFunction } from 'express';
import * as attendanceService from '../services/attendance.service';
import { AuthenticatedRequest } from '../middleware/tenant.middleware';

export const markAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const payload = {
      ...req.body,
      userRole: req.user?.role,
      userId: req.user?.id,
      teacherId: req.body.teacherId || (req.user as any)?.teacherId || req.user?.id,
    };
    const result = await attendanceService.markAttendance(payload, schoolId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const filters = {
      ...req.query,
      schoolId
    };
    const result = await attendanceService.getAttendance(filters, schoolId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceByStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const result = await attendanceService.getAttendanceByStudent(req.params.studentId, schoolId, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const bulkMarkAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const { records, latitude, longitude, locationVerified, locationDistance } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Records must be an array' });
    }

    const results = await attendanceService.bulkMarkAttendance(records, schoolId, {
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
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const teacherId = (req.user as any)?.teacherId || req.user?.id;
    const result = await attendanceService.createEditRequest(schoolId, teacherId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getEditRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const filters = {
      ...req.query,
      ...(req.user?.role === 'teacher' ? { teacherId: (req.user as any)?.teacherId || req.user?.id } : {})
    };
    const result = await attendanceService.getEditRequests(schoolId, filters);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const approveEditRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user?.role !== 'admin' && req.user?.role !== 'school_admin') {
      return res.status(403).json({ success: false, message: 'Only School Admin can approve edit requests' });
    }
    const result = await attendanceService.approveEditRequest(
      req.params.id,
      req.user?.id || 'admin',
      schoolId,
      req.body.adminNote
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const rejectEditRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user?.role !== 'admin' && req.user?.role !== 'school_admin') {
      return res.status(403).json({ success: false, message: 'Only School Admin can reject edit requests' });
    }
    const result = await attendanceService.rejectEditRequest(
      req.params.id,
      req.user?.id || 'admin',
      schoolId,
      req.body.adminNote
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const result = await attendanceService.getAttendanceAuditLogs(schoolId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
