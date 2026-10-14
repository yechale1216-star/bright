import prisma from '../config/db';

export interface ConflictCheckParams {
  timetableId?: string;
  dayOfWeek: string;
  periodNumber: number;
  startTime?: string;
  endTime?: string;
  teacherId?: string | null;
  classroomId?: string | null;
  gradeId?: string;
  sectionId?: string;
  excludeSlotId?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: 'TEACHER' | 'CLASSROOM' | 'SECTION';
    message: string;
    existingSlot: any;
  }>;
}

/**
 * Validates conflicts for a proposed timetable slot
 */
export const checkSlotConflict = async (params: ConflictCheckParams): Promise<ConflictResult> => {
  const {
    dayOfWeek,
    periodNumber,
    teacherId,
    classroomId,
    gradeId,
    sectionId,
    excludeSlotId,
  } = params;

  const conflicts: ConflictResult['conflicts'] = [];

  // 1. Teacher Conflict: Is the teacher already booked in another class during this period?
  if (teacherId) {
    const conflictingTeacherSlot = await prisma.timetableSlot.findFirst({
      where: {
        id: excludeSlotId ? { not: excludeSlotId } : undefined,
        dayOfWeek: dayOfWeek.toUpperCase(),
        periodNumber,
        isCancelled: false,
        OR: [
          { teacherId },
          { substituteTeacherId: teacherId },
        ],
      },
      include: {
        subject: true,
        grade: true,
        section: true,
        teacher: true,
        classroom: true,
      },
    });

    if (conflictingTeacherSlot) {
      conflicts.push({
        type: 'TEACHER',
        message: `Teacher ${conflictingTeacherSlot.teacher?.name || 'Assigned'} is already booked for ${conflictingTeacherSlot.grade?.name} - ${conflictingTeacherSlot.section?.name} (${conflictingTeacherSlot.subject?.name}) on ${dayOfWeek} Period ${periodNumber}.`,
        existingSlot: conflictingTeacherSlot,
      });
    }
  }

  // 2. Classroom Conflict: Is the classroom already booked during this period?
  if (classroomId) {
    const conflictingRoomSlot = await prisma.timetableSlot.findFirst({
      where: {
        id: excludeSlotId ? { not: excludeSlotId } : undefined,
        dayOfWeek: dayOfWeek.toUpperCase(),
        periodNumber,
        classroomId,
        isCancelled: false,
      },
      include: {
        subject: true,
        grade: true,
        section: true,
        classroom: true,
      },
    });

    if (conflictingRoomSlot) {
      conflicts.push({
        type: 'CLASSROOM',
        message: `Classroom ${conflictingRoomSlot.classroom?.name || 'Selected room'} is already occupied by ${conflictingRoomSlot.grade?.name} - ${conflictingRoomSlot.section?.name} on ${dayOfWeek} Period ${periodNumber}.`,
        existingSlot: conflictingRoomSlot,
      });
    }
  }

  // 3. Section Conflict: Does this section already have a subject in this period?
  if (gradeId && sectionId) {
    const conflictingSectionSlot = await prisma.timetableSlot.findFirst({
      where: {
        id: excludeSlotId ? { not: excludeSlotId } : undefined,
        dayOfWeek: dayOfWeek.toUpperCase(),
        periodNumber,
        gradeId,
        sectionId,
        isCancelled: false,
      },
      include: {
        subject: true,
        teacher: true,
      },
    });

    if (conflictingSectionSlot) {
      conflicts.push({
        type: 'SECTION',
        message: `This section already has ${conflictingSectionSlot.subject?.name} scheduled during Period ${periodNumber} on ${dayOfWeek}.`,
        existingSlot: conflictingSectionSlot,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
};

/**
 * List all timetables with summary counts
 */
export const listTimetables = async (filters: {
  gradeId?: string;
  sectionId?: string;
  academicYearId?: string;
  status?: string;
}) => {
  const where: any = {};
  if (filters.gradeId) where.gradeId = filters.gradeId;
  if (filters.sectionId) where.sectionId = filters.sectionId;
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters.status) where.status = filters.status;

  return await prisma.timetable.findMany({
    where,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      grade: true,
      section: true,
      stream: true,
      academicYear: true,
      term: true,
      _count: {
        select: { slots: true },
      },
    },
  });
};

/**
 * Get detailed timetable with all slots, subjects, teachers, and classrooms
 */
export const getTimetableById = async (id: string) => {
  return await prisma.timetable.findUnique({
    where: { id },
    include: {
      grade: true,
      section: true,
      stream: true,
      academicYear: true,
      term: true,
      slots: {
        orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
        include: {
          subject: true,
          teacher: true,
          substituteTeacher: true,
          classroom: true,
          period: true,
        },
      },
    },
  });
};

/**
 * Create a new timetable
 */
export const createTimetable = async (data: {
  title: string;
  gradeId: string;
  sectionId?: string;
  streamId?: string;
  academicYearId?: string;
  termId?: string;
  createdById?: string;
}) => {
  return await prisma.timetable.create({
    data: {
      title: data.title,
      gradeId: data.gradeId,
      sectionId: data.sectionId || null,
      streamId: data.streamId || null,
      academicYearId: data.academicYearId || null,
      termId: data.termId || null,
      createdById: data.createdById || null,
      status: 'DRAFT',
      version: 1,
    },
    include: {
      grade: true,
      section: true,
      stream: true,
    },
  });
};

/**
 * Update timetable metadata or status
 */
export const updateTimetable = async (
  id: string,
  data: {
    title?: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
  }
) => {
  const updateData: any = { ...data };
  if (data.status === 'PUBLISHED') {
    updateData.publishedAt = new Date();
  }

  return await prisma.timetable.update({
    where: { id },
    data: updateData,
    include: {
      grade: true,
      section: true,
      stream: true,
    },
  });
};

/**
 * Add or update a slot in a timetable
 */
export const upsertSlot = async (data: {
  slotId?: string;
  timetableId: string;
  dayOfWeek: string;
  periodNumber: number;
  periodId?: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId?: string | null;
  classroomId?: string | null;
  gradeId: string;
  sectionId: string;
  streamId?: string | null;
  notes?: string | null;
  substituteTeacherId?: string | null;
}) => {
  if (data.slotId) {
    return await prisma.timetableSlot.update({
      where: { id: data.slotId },
      data: {
        dayOfWeek: data.dayOfWeek.toUpperCase(),
        periodNumber: data.periodNumber,
        periodId: data.periodId || null,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId,
        teacherId: data.teacherId || null,
        classroomId: data.classroomId || null,
        notes: data.notes || null,
        substituteTeacherId: data.substituteTeacherId || null,
      },
      include: {
        subject: true,
        teacher: true,
        substituteTeacher: true,
        classroom: true,
      },
    });
  }

  return await prisma.timetableSlot.create({
    data: {
      timetableId: data.timetableId,
      dayOfWeek: data.dayOfWeek.toUpperCase(),
      periodNumber: data.periodNumber,
      periodId: data.periodId || null,
      startTime: data.startTime,
      endTime: data.endTime,
      subjectId: data.subjectId,
      teacherId: data.teacherId || null,
      classroomId: data.classroomId || null,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      streamId: data.streamId || null,
      notes: data.notes || null,
      substituteTeacherId: data.substituteTeacherId || null,
    },
    include: {
      subject: true,
      teacher: true,
      substituteTeacher: true,
      classroom: true,
    },
  });
};

/**
 * Delete a slot
 */
export const deleteSlot = async (slotId: string) => {
  return await prisma.timetableSlot.delete({
    where: { id: slotId },
  });
};

/**
 * Get or seed default period schedules
 */
export const getPeriods = async () => {
  let periods = await prisma.timetablePeriod.findMany({
    orderBy: { periodNumber: 'asc' },
  });

  if (periods.length === 0) {
    const defaultPeriods = [
      { name: 'Period 1', periodNumber: 1, startTime: '08:30', endTime: '09:15', isBreak: false },
      { name: 'Period 2', periodNumber: 2, startTime: '09:20', endTime: '10:05', isBreak: false },
      { name: 'Morning Break', periodNumber: 3, startTime: '10:05', endTime: '10:30', isBreak: true },
      { name: 'Period 3', periodNumber: 4, startTime: '10:30', endTime: '11:15', isBreak: false },
      { name: 'Period 4', periodNumber: 5, startTime: '11:20', endTime: '12:05', isBreak: false },
      { name: 'Lunch Break', periodNumber: 6, startTime: '12:05', endTime: '01:05', isBreak: true },
      { name: 'Period 5', periodNumber: 7, startTime: '01:10', endTime: '01:55', isBreak: false },
      { name: 'Period 6', periodNumber: 8, startTime: '02:00', endTime: '02:45', isBreak: false },
    ];

    for (const p of defaultPeriods) {
      await prisma.timetablePeriod.create({ data: p });
    }

    periods = await prisma.timetablePeriod.findMany({
      orderBy: { periodNumber: 'asc' },
    });
  }

  return periods;
};

/**
 * Get classrooms or seed defaults if none exist
 */
export const getClassrooms = async () => {
  let rooms = await prisma.classroom.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (rooms.length === 0) {
    const defaultRooms = [
      { name: 'Room 101', code: 'R101', building: 'Main Hall', floor: '1st Floor', capacity: 45, type: 'STANDARD' },
      { name: 'Room 102', code: 'R102', building: 'Main Hall', floor: '1st Floor', capacity: 45, type: 'STANDARD' },
      { name: 'Room 103', code: 'R103', building: 'Main Hall', floor: '1st Floor', capacity: 40, type: 'STANDARD' },
      { name: 'Room 201', code: 'R201', building: 'East Wing', floor: '2nd Floor', capacity: 40, type: 'STANDARD' },
      { name: 'Room 204', code: 'R204', building: 'East Wing', floor: '2nd Floor', capacity: 40, type: 'STANDARD' },
      { name: 'Science Lab 1', code: 'LAB-SCI', building: 'STEM Block', floor: 'Ground', capacity: 35, type: 'LABORATORY' },
      { name: 'Computer Lab', code: 'LAB-IT', building: 'STEM Block', floor: '1st Floor', capacity: 35, type: 'COMPUTER_LAB' },
    ];

    for (const r of defaultRooms) {
      await prisma.classroom.create({ data: r });
    }

    rooms = await prisma.classroom.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  return rooms;
};
