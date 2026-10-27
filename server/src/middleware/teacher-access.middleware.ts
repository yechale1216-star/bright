import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { teacherAccessService } from '../services/teacher-access.service';

/**
 * Express middleware to enforce Teacher Portal Lifecycle and Active Academic-Year Access Control.
 * Applied to teacher-facing routes or mounted as a guard.
 */
export const requireActiveTeacher = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const role = req.user.role?.toLowerCase() || '';

  // Non-teachers (admins, staff, etc.) bypass teaching assignment checks
  if (teacherAccessService.isAdmin(role)) {
    return next();
  }

  // Only apply to teachers
  if (role !== 'teacher') {
    return next();
  }

  try {
    // 1. Validate active account, employment status, and active-year assignment
    const access = await teacherAccessService.validateTeacherActiveAccess(req.user.id);

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        code: access.code || 'ACCESS_DENIED',
        message: access.message,
      });
    }

    // 2. Reject requests attempting to access previous or future academic years
    const requestedYear = req.query.academicYearId || req.body.academicYearId || (req.query as any).academicYear;
    if (requestedYear && requestedYear !== access.currentYear?.id && requestedYear !== access.currentYear?.name) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_ACADEMIC_YEAR',
        message: `Access denied. Teachers are restricted to the currently active academic year (${access.currentYear?.name}). Historical or future academic year access (${requestedYear}) is prohibited.`,
      });
    }

    // Attach verified teacher context to request
    (req as any).teacherContext = access;
    next();
  } catch (error: any) {
    next(error);
  }
};

