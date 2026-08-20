import { Response, NextFunction } from 'express';
import * as analyticsService from '../services/attendance-analytics.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getAttendanceSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getAttendanceSummary(undefined, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getGradeStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getGradeStats(undefined, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceTrends = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const trends = await analyticsService.getAttendanceTrends(undefined, req.query);
    res.status(200).json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
};

export const getDrillDownStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getDrillDownStats(undefined, req.params.gradeId, req.query);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const exportAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await analyticsService.getAttendanceTrends(undefined, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

