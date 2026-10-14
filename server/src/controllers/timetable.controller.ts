import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as timetableService from '../services/timetable.service';

export const listTimetables = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { gradeId, sectionId, academicYearId, status } = req.query as any;
    const timetables = await timetableService.listTimetables({
      gradeId,
      sectionId,
      academicYearId,
      status,
    });
    return res.status(200).json({ success: true, data: timetables });
  } catch (err) {
    next(err);
  }
};

export const getTimetableById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const timetable = await timetableService.getTimetableById(id);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable not found.' });
    }
    return res.status(200).json({ success: true, data: timetable });
  } catch (err) {
    next(err);
  }
};

export const createTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { title, gradeId, sectionId, streamId, academicYearId, termId } = req.body;
    if (!title || !gradeId) {
      return res.status(400).json({ success: false, message: 'Title and Grade are required.' });
    }

    const timetable = await timetableService.createTimetable({
      title,
      gradeId,
      sectionId,
      streamId,
      academicYearId,
      termId,
      createdById: req.user?.id,
    });

    return res.status(201).json({ success: true, data: timetable });
  } catch (err) {
    next(err);
  }
};

export const updateTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, status, effectiveStartDate, effectiveEndDate } = req.body;

    const updated = await timetableService.updateTimetable(id, {
      title,
      status,
      effectiveStartDate: effectiveStartDate ? new Date(effectiveStartDate) : undefined,
      effectiveEndDate: effectiveEndDate ? new Date(effectiveEndDate) : undefined,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const checkConflict = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await timetableService.checkSlotConflict(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const upsertSlot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { timetableId } = req.params;
    const {
      slotId,
      dayOfWeek,
      periodNumber,
      periodId,
      startTime,
      endTime,
      subjectId,
      teacherId,
      classroomId,
      gradeId,
      sectionId,
      streamId,
      notes,
      substituteTeacherId,
      force,
    } = req.body;

    if (!dayOfWeek || !periodNumber || !subjectId) {
      return res.status(400).json({ success: false, message: 'Day, Period, and Subject are required.' });
    }

    // Check conflicts if force is not true
    if (!force) {
      const conflictCheck = await timetableService.checkSlotConflict({
        dayOfWeek,
        periodNumber,
        teacherId,
        classroomId,
        gradeId,
        sectionId,
        excludeSlotId: slotId,
      });

      if (conflictCheck.hasConflict) {
        return res.status(409).json({
          success: false,
          message: 'Schedule conflict detected.',
          conflicts: conflictCheck.conflicts,
        });
      }
    }

    const slot = await timetableService.upsertSlot({
      slotId,
      timetableId,
      dayOfWeek,
      periodNumber,
      periodId,
      startTime: startTime || '08:30',
      endTime: endTime || '09:15',
      subjectId,
      teacherId,
      classroomId,
      gradeId,
      sectionId,
      streamId,
      notes,
      substituteTeacherId,
    });

    return res.status(200).json({ success: true, data: slot });
  } catch (err) {
    next(err);
  }
};

export const deleteSlot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { slotId } = req.params;
    await timetableService.deleteSlot(slotId);
    return res.status(200).json({ success: true, message: 'Slot deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

export const getPeriods = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const periods = await timetableService.getPeriods();
    return res.status(200).json({ success: true, data: periods });
  } catch (err) {
    next(err);
  }
};

export const getClassrooms = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rooms = await timetableService.getClassrooms();
    return res.status(200).json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
};
