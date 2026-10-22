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
    if (!title || !gradeId || !sectionId) {
      return res.status(400).json({ success: false, message: 'Title, Grade Level, and Section are required.' });
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
  } catch (err: any) {
    if (err.message?.includes('Cannot publish')) {
      return res.status(422).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const validateTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await timetableService.validateTimetable(id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const duplicateTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { targetSectionId, title } = req.body;

    if (!targetSectionId) {
      return res.status(400).json({ success: false, message: 'Target section is required for duplication.' });
    }

    const cloned = await timetableService.duplicateTimetable({
      sourceTimetableId: id,
      targetSectionId,
      newTitle: title,
      createdById: req.user?.id,
    });

    return res.status(201).json({ success: true, data: cloned });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message || 'Duplication failed' });
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
      force,
    });

    return res.status(200).json({ success: true, data: slot });
  } catch (err: any) {
    if (err.status === 409 || err.conflicts) {
      return res.status(409).json({
        success: false,
        message: err.message || 'Schedule conflict detected.',
        conflicts: err.conflicts || [],
      });
    }
    next(err);
  }
};

export const copyOrMoveSlot = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { slotId, targetDayOfWeek, targetPeriodNumber, isMove } = req.body;

    if (!slotId || !targetDayOfWeek || !targetPeriodNumber) {
      return res.status(400).json({
        success: false,
        message: 'Slot ID, Target Day, and Target Period are required.',
      });
    }

    const slot = await timetableService.copyOrMoveSlot({
      slotId,
      targetDayOfWeek,
      targetPeriodNumber: Number(targetPeriodNumber),
      isMove: Boolean(isMove),
    });

    return res.status(200).json({ success: true, data: slot });
  } catch (err: any) {
    if (err.status === 409) {
      return res.status(409).json({ success: false, message: err.message, conflicts: err.conflicts });
    }
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

export const getTeacherSchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { teacherId } = req.params;
    const slots = await timetableService.getTeacherSchedule(teacherId);
    const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const grouped: Record<string, any[]> = {};
    for (const day of DAY_ORDER) grouped[day] = [];
    for (const slot of slots) {
      const day = (slot.dayOfWeek as string).toUpperCase();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(slot);
    }
    return res.status(200).json({ success: true, data: grouped });
  } catch (err) {
    next(err);
  }
};

export const getMySchedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const teacherId = await timetableService.resolveTeacherId(user);
    if (!teacherId) {
      return res.status(400).json({ success: false, message: 'Teacher identity not found.' });
    }
    const slots = await timetableService.getTeacherSchedule(teacherId);
    const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const grouped: Record<string, any[]> = {};
    for (const day of DAY_ORDER) grouped[day] = [];
    for (const slot of slots) {
      const day = (slot.dayOfWeek as string).toUpperCase();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(slot);
    }
    return res.status(200).json({ success: true, data: grouped });
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

export const updatePeriods = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { periods } = req.body;
    if (!Array.isArray(periods)) {
      return res.status(400).json({ success: false, message: 'Periods array is required' });
    }
    const updated = await timetableService.updatePeriods(periods);
    return res.status(200).json({ success: true, data: updated });
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

export const generateTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      academicYearId,
      termId,
      gradeId,
      sectionId,
      streamId,
      schoolDays,
      periodsPerDay,
      subjectRequirements,
      replaceExistingDraftId,
      title,
    } = req.body;

    if (!gradeId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Grade Level and Section are required for automatic timetable generation.',
      });
    }

    const result = await timetableService.generateTimetableAutomatic({
      academicYearId,
      termId,
      gradeId,
      sectionId,
      streamId,
      schoolDays,
      periodsPerDay: periodsPerDay ? Number(periodsPerDay) : undefined,
      subjectRequirements,
      replaceExistingDraftId,
      createdById: req.user?.id,
      title,
    });

    return res.status(200).json({
      success: true,
      message: `Timetable generated successfully with ${result.summary.totalScheduled} scheduled periods.`,
      data: result,
    });
  } catch (err: any) {
    if (
      err.message?.includes('Impossible') ||
      err.message?.includes('Missing Teacher') ||
      err.message?.includes('exceeds available') ||
      err.message?.includes('No subjects')
    ) {
      return res.status(422).json({
        success: false,
        message: err.message,
      });
    }
    next(err);
  }
};
