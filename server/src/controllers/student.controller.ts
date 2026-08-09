import { Response, NextFunction } from 'express';
import * as studentService from '../services/student.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const getStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const search = req.query.search as string | undefined;
    const students = await studentService.getAllStudents(schoolId, search);
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

export const getNextStudentId = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const nextId = await studentService.getNextStudentId(schoolId);
    res.status(200).json({ success: true, data: nextId });
  } catch (error) {
    next(error);
  }
};

export const createStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const student = await studentService.createStudent(req.body, schoolId);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

export const getStudentById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const student = await studentService.getStudentById(req.params.id, schoolId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const student = await studentService.updateStudent(req.params.id, req.body, schoolId);
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

export const deleteStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    console.log(`[StudentController] Delete requested. StudentID: ${req.params.id}, SchoolID: ${schoolId}, UserRole: ${req.user?.role}`);
    
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    await studentService.deleteStudent(req.params.id, schoolId);
    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getStudentsByParentPhone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const students = await studentService.getStudentsByParentPhone(req.params.phone, schoolId);
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};
export const bulkCreateStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(401).json({ success: false, message: 'School ID context missing' });
    }
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of students.' });
    }
    const results = await studentService.bulkUpsertStudents(students, schoolId);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};
