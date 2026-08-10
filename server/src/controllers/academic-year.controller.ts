import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { academicYearService } from '../services/academic-year.service';

export const getAcademicYears = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const years = await academicYearService.getAcademicYears(schoolId);
    res.status(200).json({ success: true, data: years });
  } catch (error) {
    next(error);
  }
};

export const getCurrentAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const current = await academicYearService.getCurrentAcademicYear(schoolId);
    res.status(200).json({ success: true, data: current });
  } catch (error) {
    next(error);
  }
};

export const createAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const newYear = await academicYearService.createAcademicYear(schoolId, req.body);
    res.status(201).json({ success: true, data: newYear });
  } catch (error) {
    next(error);
  }
};

export const updateAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const updated = await academicYearService.updateAcademicYear(schoolId, id, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const activateAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const active = await academicYearService.activateAcademicYear(schoolId, id);
    res.status(200).json({ success: true, data: active });
  } catch (error) {
    next(error);
  }
};

export const deleteAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    await academicYearService.deleteAcademicYear(schoolId, id);
    res.status(200).json({ success: true, message: 'Academic year deleted successfully' });
  } catch (error) {
    next(error);
  }
};
