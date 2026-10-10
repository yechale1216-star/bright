import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { learningMaterialService } from '../services/homework.service';
import { verifyTeacherClassSubjectAccess } from '../services/assignment.service';

export const getMaterials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, subjectId } = req.query as any;
    const data = await learningMaterialService.getMaterials({ gradeId, subjectId });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const getMaterialById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await learningMaterialService.getMaterialById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Material not found' });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const createMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const uploadedById = req.user?.id;
    const { gradeId, subjectId } = req.body;

    // Teachers may only create materials for grades/subjects they are assigned to
    if (uploadedById && gradeId && subjectId) {
      const access = await verifyTeacherClassSubjectAccess(uploadedById, { gradeId, subjectId });
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason || 'You are not assigned to this grade and subject.' });
      }
    }

    const data = await learningMaterialService.createMaterial({ ...req.body, uploadedById });
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

export const updateMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await learningMaterialService.updateMaterial(req.params.id, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

export const deleteMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await learningMaterialService.deleteMaterial(req.params.id);
    res.status(200).json({ success: true, message: 'Material deleted' });
  } catch (error) { next(error); }
};

export const getStudentMaterials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { subjectId } = req.query as any;
    const data = await learningMaterialService.getStudentMaterials(studentId, { subjectId });
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};
