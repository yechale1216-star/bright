import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AssessmentPolicyService } from '../services/assessment-policy.service';

// ─── Assessment Types ──────────────────────────────────────────────────────

export const getAssessmentTypes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const types = await AssessmentPolicyService.getAssessmentTypes(includeInactive);
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
};

export const seedAssessmentTypes = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const types = await AssessmentPolicyService.seedDefaultTypes();
    res.status(200).json({ success: true, data: types, message: 'Default assessment types seeded.' });
  } catch (error) {
    next(error);
  }
};

export const createAssessmentType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const type = await AssessmentPolicyService.createAssessmentType(req.body);
    res.status(201).json({ success: true, data: type, message: 'Assessment type created.' });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateAssessmentType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const type = await AssessmentPolicyService.updateAssessmentType(id, req.body);
    res.status(200).json({ success: true, data: type, message: 'Assessment type updated.' });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const deleteAssessmentType = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await AssessmentPolicyService.deleteAssessmentType(id);
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─── Assessment Weight Schemes ─────────────────────────────────────────────

export const getSchemes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, isTemplate } = req.query as Record<string, string>;
    const schemes = await AssessmentPolicyService.getSchemes({
      academicYearId,
      isTemplate: isTemplate !== undefined ? isTemplate === 'true' : undefined,
    });
    res.status(200).json({ success: true, data: schemes });
  } catch (error) {
    next(error);
  }
};

export const getSchemeById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const scheme = await AssessmentPolicyService.getSchemeById(req.params.id);
    res.status(200).json({ success: true, data: scheme });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const createScheme = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const scheme = await AssessmentPolicyService.createScheme(req.body);
    res.status(201).json({ success: true, data: scheme, message: 'Assessment policy scheme created.' });
  } catch (error: any) {
    if (error.message?.includes('100%') || error.message?.includes('required') || error.message?.includes('positive')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateScheme = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scheme = await AssessmentPolicyService.updateScheme(id, req.body);
    res.status(200).json({ success: true, data: scheme, message: 'Assessment policy scheme updated.' });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message?.includes('locked') || error.message?.includes('100%') || error.message?.includes('positive')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const deleteScheme = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await AssessmentPolicyService.deleteScheme(id);
    res.status(200).json({ success: true, message: 'Assessment policy scheme deleted.' });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message?.includes('locked') || error.message?.includes('Cannot delete')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─── Scheme Assignments ────────────────────────────────────────────────────

export const assignScheme = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await AssessmentPolicyService.assignScheme(req.body);
    res.status(200).json({ success: true, data: assignment, message: 'Scheme assigned successfully.' });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const deleteSchemeAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await AssessmentPolicyService.deleteSchemeAssignment(id);
    res.status(200).json({ success: true, message: 'Scheme assignment removed.' });
  } catch (error) {
    next(error);
  }
};

// ─── Context Resolution ────────────────────────────────────────────────────

export const resolveSchemeForContext = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, academicTermId, gradeId, streamId, subjectId } = req.query as Record<string, string>;
    if (!academicYearId) {
      return res.status(400).json({ success: false, message: 'academicYearId is required.' });
    }
    const scheme = await AssessmentPolicyService.resolveSchemeForContext({
      academicYearId, academicTermId, gradeId, streamId, subjectId,
    });
    res.status(200).json({ success: true, data: scheme });
  } catch (error) {
    next(error);
  }
};

export const ensureDefaultScheme = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const scheme = await AssessmentPolicyService.ensureDefaultPolicyScheme();
    res.status(200).json({ success: true, data: scheme, message: 'Default assessment scheme ensured.' });
  } catch (error) {
    next(error);
  }
};

export const duplicateScheme = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const duplicated = await AssessmentPolicyService.duplicateScheme(id);
    res.status(201).json({ success: true, data: duplicated, message: 'Assessment template duplicated successfully.' });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const previewBulkAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const preview = await AssessmentPolicyService.previewBulkAssignment(req.body);
    res.status(200).json({ success: true, data: preview });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('100%') || error.message?.includes('required')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const executeBulkAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await AssessmentPolicyService.executeBulkAssignment(req.body);
    res.status(200).json({ success: true, data: result, message: 'Bulk assignment completed.' });
  } catch (error: any) {
    if (error.message?.includes('required') || error.message?.includes('not found') || error.message?.includes('100%')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

