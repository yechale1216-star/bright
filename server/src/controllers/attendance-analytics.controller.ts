import { Response, NextFunction } from 'express';
import * as analyticsService from '../services/attendance-analytics.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getAttendanceSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const stats = await analyticsService.getAttendanceSummary(schoolId, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getGradeStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const stats = await analyticsService.getGradeStats(schoolId, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceTrends = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const trends = await analyticsService.getAttendanceTrends(schoolId, req.query);
    res.status(200).json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
};

export const getDrillDownStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const stats = await analyticsService.getDrillDownStats(schoolId, req.params.gradeId, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const exportAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    // For now, return a raw list or summary that can be converted to CSV on frontend
    const data = await analyticsService.getAttendanceTrends(schoolId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
