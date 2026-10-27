import { Response, NextFunction } from 'express';
import * as studentService from '../services/student.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const AUTHORIZED_STAFF_ROLES = ['admin', 'school_admin', 'super_admin', 'registrar'];

const sanitizeStudentForRole = (student: any, role?: string) => {
  if (!student) return null;
  const isAuthorized = AUTHORIZED_STAFF_ROLES.includes(role || '');
  const canSeeActivation = isAuthorized && student.accountStatus === 'PENDING_ACTIVATION';
  const isPlaintextLegacy = student.activation_code && !student.activation_code.startsWith('$2') && student.activation_code.length <= 10;
  return {
    ...student,
    // Never expose cryptographic hashes or passwords over API
    activation_code: canSeeActivation && isPlaintextLegacy ? student.activation_code : null,
    has_activation_code: canSeeActivation ? Boolean(student.activation_code) : false,
    activation_code_expires: canSeeActivation ? student.activation_code_expires : null,
  };
};

export const getStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const gradeId = req.query.gradeId as string | undefined;
    const sectionId = req.query.sectionId as string | undefined;
    const streamId = req.query.streamId as string | undefined;
    const academicYear = req.query.academicYear as string | undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const pagination = (page !== undefined || limit !== undefined)
      ? { page, limit }
      : undefined;

    const students = await studentService.getAllStudents(undefined, search, status, gradeId, sectionId, streamId, academicYear, pagination);
    
    const userRole = req.user?.role;
    let sanitizedData: any;
    if (Array.isArray(students)) {
      sanitizedData = students.map((s) => sanitizeStudentForRole(s, userRole));
    } else if (students && Array.isArray((students as any).items)) {
      sanitizedData = {
        ...students,
        items: (students as any).items.map((s: any) => sanitizeStudentForRole(s, userRole)),
      };
    } else {
      sanitizedData = sanitizeStudentForRole(students, userRole);
    }

    res.status(200).json({ success: true, data: sanitizedData });
  } catch (error) {
    next(error);
  }
};

export const getNextStudentId = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const nextId = await studentService.getNextStudentId();
    res.status(200).json({ success: true, data: nextId });
  } catch (error) {
    next(error);
  }
};

export const createStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.createStudent(req.body);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

export const getStudentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const userRole = req.user?.role;
    res.status(200).json({ success: true, data: sanitizeStudentForRole(student, userRole) });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

export const deleteStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await studentService.deleteStudent(req.params.id);
    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getStudentsByParentPhone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const students = await studentService.getStudentsByParentPhone(req.params.phone);
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of students.' });
    }
    const results = await studentService.bulkUpsertStudents(students);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

// ─── ACTIVATION CODE MANAGEMENT ───────────────────────────────────────────────

export const generateActivationCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const slip = await studentService.generateActivationCode(id);
    res.status(200).json({ success: true, data: slip });
  } catch (error) {
    next(error);
  }
};

export const bulkGenerateActivationCodes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId } = req.body;
    const slips = await studentService.bulkGenerateActivationCodes(gradeId, sectionId);
    res.status(200).json({ success: true, data: slips });
  } catch (error) {
    next(error);
  }
};

// ─── LIFECYCLE & STATUS MANAGEMENT ──────────────────────────────────────────

export const changeStudentStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newStatus, effectiveDate, reason, suspensionEndDate, destinationSchool } = req.body;
    const changedByUserId = req.user?.id;
    if (!changedByUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!newStatus || !effectiveDate || !reason) {
      return res.status(400).json({ success: false, message: 'newStatus, effectiveDate, and reason are required.' });
    }
    const { changeStudentStatus: svc } = await import('../services/student-status.service');
    const result = await svc(id, {
      newStatus,
      effectiveDate,
      reason,
      suspensionEndDate,
      destinationSchool,
      changedByUserId,
    });
    res.status(200).json({
      success: true,
      data: result,
      message: `Student status successfully changed to ${newStatus}.`,
    });
  } catch (error: any) {
    if (
      error.message?.includes('Invalid status transition') ||
      error.message?.includes('required') ||
      error.message?.includes('permanent') ||
      error.message?.includes('already in')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const getStudentStatusHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { getStudentStatusHistory: svc } = await import('../services/student-status.service');
    const history = await svc(req.params.id);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

export const reEnrollStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { academicYearId, gradeId, sectionId, streamId } = req.body;
    const enrolledByUserId = req.user?.id;
    if (!enrolledByUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!academicYearId || !gradeId || !sectionId) {
      return res.status(400).json({ success: false, message: 'academicYearId, gradeId, and sectionId are required.' });
    }
    const { reEnrollStudent: svc } = await import('../services/student-status.service');
    const enrollment = await svc(id, academicYearId, gradeId, sectionId, streamId || null, enrolledByUserId);
    res.status(200).json({ success: true, data: enrollment, message: 'Student successfully re-enrolled.' });
  } catch (error: any) {
    if (error.message?.includes('Cannot re-enroll') || error.message?.includes('already has') || error.message?.includes('required')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

