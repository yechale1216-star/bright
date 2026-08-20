import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { academicYearService } from '../services/academic-year.service';

export const getAcademicYears = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const years = await academicYearService.getAcademicYears();
    res.status(200).json({ success: true, data: years });
  } catch (error) {
    next(error);
  }
};

export const getCurrentAcademicYear = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const current = await academicYearService.getCurrentAcademicYear();
    res.status(200).json({ success: true, data: current });
  } catch (error) {
    next(error);
  }
};

export const createAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const newYear = await academicYearService.createAcademicYear(undefined, req.body);
    res.status(201).json({ success: true, data: newYear });
  } catch (error) {
    next(error);
  }
};

export const updateAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updated = await academicYearService.updateAcademicYear(undefined, id, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const activateAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const active = await academicYearService.activateAcademicYear(undefined, id);
    res.status(200).json({ success: true, data: active });
  } catch (error) {
    next(error);
  }
};

export const deleteAcademicYear = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await academicYearService.deleteAcademicYear(undefined, id);
    res.status(200).json({ success: true, message: 'Academic year deleted successfully' });
  } catch (error) {
    next(error);
  }
};

