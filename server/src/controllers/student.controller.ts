import { Response, NextFunction } from 'express';
import * as studentService from '../services/student.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const AUTHORIZED_STAFF_ROLES = ['admin', 'school_admin', 'super_admin', 'registrar'];

const sanitizeStudentForRole = (student: any, role?: string) => {
  if (!student) return null;
  const isAuthorized = AUTHORIZED_STAFF_ROLES.includes(role || '');
  const canSeeActivation = isAuthorized && student.accountStatus === 'PENDING_ACTIVATION';
  return {
    ...student,
    activation_code: canSeeActivation ? student.activation_code : null,
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

