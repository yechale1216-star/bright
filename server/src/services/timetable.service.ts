import prisma from '../config/db';

export interface ConflictCheckParams {
  timetableId?: string;
  dayOfWeek: string;
  periodNumber: number;
  startTime?: string;
  endTime?: string;
  subjectId?: string;
  teacherId?: string | null;
  classroomId?: string | null;
  gradeId?: string;
  sectionId?: string;
  streamId?: string | null;
  excludeSlotId?: string;
}

export interface ConflictItem {
  type: 'TEACHER' | 'CLASSROOM' | 'SECTION' | 'SUBJECT_MISMATCH' | 'TEACHER_ASSIGNMENT';
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  existingSlot?: any;
}

export interface ConflictResult {
  hasConflict: boolean;
  hasCriticalConflict: boolean;
  conflicts: ConflictItem[];
}

/**
 * Resolves an incoming identifier (which may be a Teacher.id, User.id, or user object)
 * to the canonical Teacher.id
 */
export const resolveTeacherId = async (
  input?: string | { id?: string; email?: string } | null
): Promise<string | null> => {
  if (!input || input === 'none') return null;

  const rawId = typeof input === 'string' ? input : input.id;
  const rawEmail = typeof input === 'object' && input !== null ? input.email : undefined;

  if (!rawId && !rawEmail) return null;

  if (rawId) {
    // 1. Direct match on Teacher.id
    const directTeacher = await prisma.teacher.findUnique({
      where: { id: rawId },
      select: { id: true },
    });
    if (directTeacher) return directTeacher.id;

    // 2. Match on User.id where user.teacher_id is set
    const user = await prisma.user.findUnique({
      where: { id: rawId },
      select: { teacher_id: true, email: true },
    });
    if (user?.teacher_id) return user.teacher_id;

    // 3. Match on Teacher.user_id = rawId or Teacher.email
    const teacherByUser = await prisma.teacher.findFirst({
      where: {
        OR: [
          { user_id: rawId },
          ...(rawEmail ? [{ email: rawEmail }] : []),
          ...(user?.email ? [{ email: user.email }] : []),
        ],
      },
      select: { id: true },
    });
    if (teacherByUser) return teacherByUser.id;

    return rawId;
  }

  if (rawEmail) {
    const teacherByEmail = await prisma.teacher.findFirst({
      where: { email: rawEmail },
      select: { id: true },
    });
    if (teacherByEmail) return teacherByEmail.id;
  }

  return null;
};

/**
 * Returns all potential IDs representing this teacher (both Teacher.id and User.id)
 * so lookups across tables with differing conventions find the record reliably.
 */
export const getTeacherIdentifierCandidates = async (id?: string | null): Promise<string[]> => {
  if (!id || id === 'none') return [];
  const candidates = new Set<string>([id]);

  try {
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [{ id }, { user_id: id }],
      },
      select: { id: true, user_id: true },
    });
    if (teacher) {
      candidates.add(teacher.id);
      if (teacher.user_id) candidates.add(teacher.user_id);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, teacher_id: true },
    });
    if (user) {
      candidates.add(user.id);
      if (user.teacher_id) candidates.add(user.teacher_id);
    }
  } catch (err) {
    console.error('Error resolving teacher identifier candidates:', err);
  }

  return Array.from(candidates);
};

/**
 * Validates conflicts for a proposed timetable slot
 */
export const checkSlotConflict = async (params: ConflictCheckParams): Promise<ConflictResult> => {
  const {
    dayOfWeek,
    periodNumber,
    subjectId,
    teacherId,
    classroomId,
    gradeId,
    sectionId,
    streamId,
    excludeSlotId,
  } = params;

  const conflicts: ConflictItem[] = [];
  const normalizedDay = dayOfWeek.toUpperCase();
  const teacherCandidateIds = teacherId ? await getTeacherIdentifierCandidates(teacherId) : [];

  // 1. Teacher Conflict: Is the teacher already booked in another class during this period?
  if (teacherCandidateIds.length > 0) {
    const conflictingTeacherSlot = await prisma.timetableSlot.findFirst({
      where: {
        id: excludeSlotId ? { not: excludeSlotId } : undefined,
        dayOfWeek: normalizedDay,
        periodNumber,
        isCancelled: false,
        OR: [
          { teacherId: { in: teacherCandidateIds } },
          { substituteTeacherId: { in: teacherCandidateIds } },
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
        severity: 'CRITICAL',
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
        dayOfWeek: normalizedDay,
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
        severity: 'CRITICAL',
        message: `Classroom ${conflictingRoomSlot.classroom?.name || 'Selected room'} is already occupied by ${conflictingRoomSlot.grade?.name} - ${conflictingRoomSlot.section?.name} on ${dayOfWeek} Period ${periodNumber}.`,
        existingSlot: conflictingRoomSlot,
      });
    }
  }

  // 3. Section Conflict: Does this section already have another subject in this period?
  if (gradeId && sectionId) {
    const conflictingSectionSlot = await prisma.timetableSlot.findFirst({
      where: {
        id: excludeSlotId ? { not: excludeSlotId } : undefined,
        dayOfWeek: normalizedDay,
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
        severity: 'CRITICAL',
        message: `This section already has ${conflictingSectionSlot.subject?.name} scheduled during Period ${periodNumber} on ${dayOfWeek}.`,
        existingSlot: conflictingSectionSlot,
      });
    }
  }

  // 4. Subject Academic Qualification: Does the subject belong to this grade (and stream)?
  if (subjectId && gradeId) {
    const gradeSubjects = await prisma.gradeSubject.findMany({
      where: {
        gradeId,
        ...(streamId ? { OR: [{ streamId }, { streamId: null }] } : {}),
      },
    });

    // If curriculum is configured for this grade, ensure the subject is mapped
    if (gradeSubjects.length > 0) {
      const isSubjectInGrade = gradeSubjects.some((gs) => gs.subjectId === subjectId);
      if (!isSubjectInGrade) {
        conflicts.push({
          type: 'SUBJECT_MISMATCH',
          severity: 'CRITICAL',
          message: 'Selected subject is not in the assigned curriculum for this grade/stream.',
        });
      }
    }
  }

  // 5. Teacher Assignment Qualification: Is the teacher officially assigned to teach this subject in this class?
  if (teacherCandidateIds.length > 0 && subjectId && gradeId) {
    let resolvedSubName: string | undefined;
    const subRecord = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { name: true },
    });
    if (subRecord?.name) resolvedSubName = subRecord.name;

    const subjectFilter: any[] = [
      { subjectId },
      ...(resolvedSubName ? [{ subject: { equals: resolvedSubName, mode: 'insensitive' as const } }] : []),
    ];

    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        teacher_id: { in: teacherCandidateIds },
        gradeId,
        ...(sectionId ? { sectionId } : {}),
        OR: subjectFilter,
      },
    });

    if (assignments.length === 0) {
      // Check if teacher teaches this subject in any section of this grade
      const anySectionAssignment = await prisma.teacherAssignment.findFirst({
        where: {
          teacher_id: { in: teacherCandidateIds },
          gradeId,
          OR: subjectFilter,
        },
      });

      if (!anySectionAssignment) {
        conflicts.push({
          type: 'TEACHER_ASSIGNMENT',
          severity: 'WARNING',
          message: 'Teacher has not been officially assigned to teach this subject for this grade in Academic Structure.',
        });
      }
    }
  }

  const hasCriticalConflict = conflicts.some((c) => c.severity === 'CRITICAL');

  return {
    hasConflict: conflicts.length > 0,
    hasCriticalConflict,
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
  if (filters.gradeId && filters.gradeId !== 'all') where.gradeId = filters.gradeId;
  if (filters.sectionId && filters.sectionId !== 'all') where.sectionId = filters.sectionId;
  if (filters.academicYearId && filters.academicYearId !== 'all') where.academicYearId = filters.academicYearId;
  if (filters.status && filters.status !== 'all') where.status = filters.status;

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
 * Update timetable metadata or workflow status (DRAFT, VALIDATED, PUBLISHED, ARCHIVED)
 */
export const updateTimetable = async (
  id: string,
  data: {
    title?: string;
    status?: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'ARCHIVED';
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
  }
) => {
  const current = await prisma.timetable.findUnique({
    where: { id },
    include: { slots: true },
  });

  if (!current) {
    throw new Error('Timetable not found');
  }

  // Pre-condition: Cannot publish if there are critical conflicts
  if (data.status === 'PUBLISHED') {
    const validation = await validateTimetable(id);
    if (validation.criticalConflicts.length > 0) {
      throw new Error(
        `Cannot publish timetable. There are ${validation.criticalConflicts.length} unresolved critical scheduling conflicts.`
      );
    }
  }

  const updateData: any = { ...data };
  if (data.status === 'PUBLISHED') {
    updateData.publishedAt = new Date();
    updateData.version = (current.version || 1) + 1;
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
 * Comprehensive Timetable Validation
 * Checks the entire timetable for conflicts, completeness, and weekly subject requirements
 */
export const validateTimetable = async (timetableId: string) => {
  const timetable = await getTimetableById(timetableId);
  if (!timetable) {
    throw new Error('Timetable not found');
  }

  const periods = await getPeriods();
  const instructionalPeriods = periods.filter((p) => !p.isBreak);
  const activeDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const totalWeeklyPeriods = activeDays.length * instructionalPeriods.length;

  const criticalConflicts: ConflictItem[] = [];
  const warnings: ConflictItem[] = [];

  // 1. Check each slot for clashes
  const slots = timetable.slots || [];
  for (const slot of slots) {
    const result = await checkSlotConflict({
      timetableId,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      classroomId: slot.classroomId,
      gradeId: slot.gradeId,
      sectionId: slot.sectionId,
      streamId: slot.streamId,
      excludeSlotId: slot.id,
    });

    for (const c of result.conflicts) {
      if (c.severity === 'CRITICAL') {
        if (!criticalConflicts.some((x) => x.message === c.message)) {
          criticalConflicts.push(c);
        }
      } else {
        if (!warnings.some((x) => x.message === c.message)) {
          warnings.push(c);
        }
      }
    }
  }

  // 2. Completeness & Unscheduled Lessons
  const scheduledCount = slots.length;
  const unscheduledCount = Math.max(0, totalWeeklyPeriods - scheduledCount);
  const completenessScore = totalWeeklyPeriods > 0
    ? Math.round((scheduledCount / totalWeeklyPeriods) * 100)
    : 0;

  // 3. Subject Distribution Analysis
  const subjectCounts: Record<string, { count: number; name: string; color: string }> = {};
  for (const slot of slots) {
    if (slot.subject) {
      if (!subjectCounts[slot.subjectId]) {
        subjectCounts[slot.subjectId] = {
          count: 0,
          name: slot.subject.name,
          color: slot.subject.color || '#6366f1',
        };
      }
      subjectCounts[slot.subjectId].count++;
    }
  }

  // 4. Update status to VALIDATED if 0 critical conflicts and was DRAFT
  if (criticalConflicts.length === 0 && timetable.status === 'DRAFT' && scheduledCount > 0) {
    await prisma.timetable.update({
      where: { id: timetableId },
      data: { status: 'VALIDATED' },
    });
  }

  return {
    isValid: criticalConflicts.length === 0,
    canPublish: criticalConflicts.length === 0 && scheduledCount > 0,
    totalWeeklyPeriods,
    scheduledCount,
    unscheduledCount,
    completenessScore,
    criticalConflicts,
    warnings,
    subjectDistribution: Object.entries(subjectCounts).map(([subjectId, data]) => ({
      subjectId,
      ...data,
    })),
  };
};

/**
 * Add or update a slot in a timetable (Atomic with transaction & conflict validation)
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
  force?: boolean;
}) => {
  const normalizedDay = data.dayOfWeek.toUpperCase();

  // Run conflict check if not forced
  if (!data.force) {
    const conflictCheck = await checkSlotConflict({
      dayOfWeek: normalizedDay,
      periodNumber: data.periodNumber,
      teacherId: data.teacherId,
      classroomId: data.classroomId,
      gradeId: data.gradeId,
      sectionId: data.sectionId,
      subjectId: data.subjectId,
      streamId: data.streamId,
      excludeSlotId: data.slotId,
    });

    if (conflictCheck.hasCriticalConflict) {
      const err: any = new Error(conflictCheck.conflicts[0]?.message || 'Scheduling clash detected.');
      err.status = 409;
      err.conflicts = conflictCheck.conflicts;
      throw err;
    }
  }

  // Resolve canonical Teacher.id before saving to prevent foreign key or lookup mismatches
  const canonicalTeacherId = await resolveTeacherId(data.teacherId);
  const canonicalSubTeacherId = await resolveTeacherId(data.substituteTeacherId);

  // Execute in atomic transaction to prevent concurrent clashes
  return await prisma.$transaction(async (tx) => {
    if (data.slotId) {
      return await tx.timetableSlot.update({
        where: { id: data.slotId },
        data: {
          dayOfWeek: normalizedDay,
          periodNumber: data.periodNumber,
          periodId: data.periodId || null,
          startTime: data.startTime,
          endTime: data.endTime,
          subjectId: data.subjectId,
          teacherId: canonicalTeacherId || null,
          classroomId: data.classroomId || null,
          notes: data.notes || null,
          substituteTeacherId: canonicalSubTeacherId || null,
        },
        include: {
          subject: true,
          teacher: true,
          substituteTeacher: true,
          classroom: true,
        },
      });
    }

    return await tx.timetableSlot.create({
      data: {
        timetableId: data.timetableId,
        dayOfWeek: normalizedDay,
        periodNumber: data.periodNumber,
        periodId: data.periodId || null,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectId: data.subjectId,
        teacherId: canonicalTeacherId || null,
        classroomId: data.classroomId || null,
        gradeId: data.gradeId,
        sectionId: data.sectionId,
        streamId: data.streamId || null,
        notes: data.notes || null,
        substituteTeacherId: canonicalSubTeacherId || null,
      },
      include: {
        subject: true,
        teacher: true,
        substituteTeacher: true,
        classroom: true,
      },
    });
  });
};

/**
 * Move or Copy Slot
 */
export const copyOrMoveSlot = async (params: {
  slotId: string;
  targetDayOfWeek: string;
  targetPeriodNumber: number;
  isMove?: boolean;
}) => {
  const sourceSlot = await prisma.timetableSlot.findUnique({
    where: { id: params.slotId },
  });

  if (!sourceSlot) {
    throw new Error('Source slot not found');
  }

  const periods = await getPeriods();
  const targetPeriod = periods.find((p) => p.periodNumber === params.targetPeriodNumber);

  // Upsert into target
  const newSlot = await upsertSlot({
    timetableId: sourceSlot.timetableId,
    dayOfWeek: params.targetDayOfWeek,
    periodNumber: params.targetPeriodNumber,
    periodId: targetPeriod?.id,
    startTime: targetPeriod?.startTime || sourceSlot.startTime,
    endTime: targetPeriod?.endTime || sourceSlot.endTime,
    subjectId: sourceSlot.subjectId,
    teacherId: sourceSlot.teacherId,
    classroomId: sourceSlot.classroomId,
    gradeId: sourceSlot.gradeId,
    sectionId: sourceSlot.sectionId,
    streamId: sourceSlot.streamId,
    notes: sourceSlot.notes,
  });

  // If move, delete the source
  if (params.isMove && sourceSlot.id !== newSlot.id) {
    await prisma.timetableSlot.delete({
      where: { id: sourceSlot.id },
    });
  }

  return newSlot;
};

/**
 * Bulk Duplicate Timetable across sections of matching grade/stream
 */
export const duplicateTimetable = async (params: {
  sourceTimetableId: string;
  targetSectionId: string;
  newTitle?: string;
  createdById?: string;
}) => {
  const source = await getTimetableById(params.sourceTimetableId);
  if (!source) {
    throw new Error('Source timetable not found');
  }

  const targetSection = await prisma.section.findUnique({
    where: { id: params.targetSectionId },
  });

  if (!targetSection) {
    throw new Error('Target section not found');
  }

  const title = params.newTitle || `${source.grade?.name} - ${targetSection.name} Timetable (Cloned)`;

  // Create new timetable header
  const created = await prisma.timetable.create({
    data: {
      title,
      gradeId: source.gradeId,
      sectionId: targetSection.id,
      streamId: source.streamId,
      academicYearId: source.academicYearId,
      termId: source.termId,
      createdById: params.createdById,
      status: 'DRAFT',
      version: 1,
    },
  });

  // Clone slots in batch
  const slotsToCreate = (source.slots || []).map((s) => ({
    timetableId: created.id,
    dayOfWeek: s.dayOfWeek,
    periodNumber: s.periodNumber,
    periodId: s.periodId,
    startTime: s.startTime,
    endTime: s.endTime,
    subjectId: s.subjectId,
    teacherId: s.teacherId,
    classroomId: s.classroomId,
    gradeId: source.gradeId,
    sectionId: targetSection.id,
    streamId: source.streamId,
    notes: s.notes,
  }));

  if (slotsToCreate.length > 0) {
    await prisma.timetableSlot.createMany({
      data: slotsToCreate,
    });
  }

  return await getTimetableById(created.id);
};

/**
 * Get schedule for a specific teacher across all active timetables
 */
export const getTeacherSchedule = async (teacherId: string) => {
  const candidateIds = await getTeacherIdentifierCandidates(teacherId);
  const idsToMatch = candidateIds.length > 0 ? candidateIds : [teacherId];

  return await prisma.timetableSlot.findMany({
    where: {
      isCancelled: false,
      OR: [
        { teacherId: { in: idsToMatch } },
        { substituteTeacherId: { in: idsToMatch } },
      ],
      timetable: {
        status: { in: ['PUBLISHED', 'VALIDATED', 'DRAFT'] },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    include: {
      subject: true,
      grade: true,
      section: true,
      classroom: true,
      timetable: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
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
 * Update or configure school master bell schedule and periods
 */
export const updatePeriods = async (periods: Array<{
  id?: string;
  name: string;
  periodNumber?: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}>) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Shift all existing periods to negative numbers to avoid unique constraint violations
    const existing = await tx.timetablePeriod.findMany();
    for (let i = 0; i < existing.length; i++) {
      await tx.timetablePeriod.update({
        where: { id: existing[i].id },
        data: { periodNumber: -(i + 100) },
      });
    }

    // 2. Identify periods to retain vs delete
    const incomingValidIds = new Set(periods.filter((p) => p.id && !p.id.startsWith('new-') && !p.id.startsWith('p-')).map((p) => p.id!));
    const toDelete = existing.filter((e) => !incomingValidIds.has(e.id));
    for (const d of toDelete) {
      await tx.timetableSlot.updateMany({
        where: { periodId: d.id },
        data: { periodId: null },
      });
      await tx.timetablePeriod.delete({ where: { id: d.id } });
    }

    // 3. Upsert / Create the new periods in ordered sequence
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const pNum = i + 1;
      if (p.id && incomingValidIds.has(p.id)) {
        await tx.timetablePeriod.update({
          where: { id: p.id },
          data: {
            name: p.name,
            periodNumber: pNum,
            startTime: p.startTime,
            endTime: p.endTime,
            isBreak: Boolean(p.isBreak),
          },
        });
      } else {
        await tx.timetablePeriod.create({
          data: {
            name: p.name,
            periodNumber: pNum,
            startTime: p.startTime,
            endTime: p.endTime,
            isBreak: Boolean(p.isBreak),
          },
        });
      }
    }

    return await tx.timetablePeriod.findMany({
      orderBy: { periodNumber: 'asc' },
    });
  });
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
