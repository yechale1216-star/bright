import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { promotionService } from '../services/promotion.service';

export const getPromotionPreview = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const preview = await promotionService.getPromotionPreview();
    res.status(200).json({ success: true, data: preview });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStudentsByGrade = async (req: AuthenticatedRequest, res: Response) => {
  const { gradeId } = req.params;
  const { sectionId, streamId } = req.query;

  try {
    const students = await promotionService.getStudentsByGrade(undefined, gradeId, sectionId as string, streamId as string);
    res.status(200).json({ success: true, data: students });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const isValidAcademicYear = (year: string): boolean => {
  if (!year || typeof year !== 'string') return false;
  const cleaned = year.trim().replace(/\s*E\.?C\.?$/i, '').trim();
  
  const rangeMatch = cleaned.match(/^(\d{4})[\/\-](\d{2,4})$/);
  if (rangeMatch) {
    const y1 = parseInt(rangeMatch[1], 10);
    let y2 = parseInt(rangeMatch[2], 10);
    if (y2 < 100) {
      const century = Math.floor(y1 / 100) * 100;
      y2 = century + y2;
    }
    return y2 === y1 + 1;
  }
  
  const singleMatch = cleaned.match(/^(\d{4})$/);
  if (singleMatch) {
    const y = parseInt(singleMatch[1], 10);
    return y >= 1900 && y <= 2100;
  }
  
  return false;
};

export const promoteStudents = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  if (!req.body.academicYear || !isValidAcademicYear(req.body.academicYear)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid academic year format. Examples: 2026/2027, 2017 E.C., 2017.'
    });
  }

  try {
    const result = await promotionService.promoteStudents(req.body, undefined, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.message.includes('Duplicate promotion')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPromotionHistory = async (req: AuthenticatedRequest, res: Response) => {
  const { academicYear } = req.query;

  try {
    const history = await promotionService.getPromotionHistory(undefined, academicYear as string);
    res.status(200).json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const rollbackPromotion = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await promotionService.rollbackPromotion(id);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
