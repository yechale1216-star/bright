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

    // Strip the "(Draft)" suffix from the title when publishing
    const currentTitle = data.title ?? current.title ?? '';
    if (currentTitle.endsWith(' (Draft)')) {
      updateData.title = currentTitle.slice(0, -' (Draft)'.length);
    }

    // Safely archive any existing published timetable for the same class/section
    await prisma.timetable.updateMany({
      where: {
        id: { not: id },
        gradeId: current.gradeId,
        sectionId: current.sectionId,
        streamId: current.streamId || null,
        status: 'PUBLISHED',
      },
      data: {
        status: 'ARCHIVED',
      },
    });
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

export interface SubjectLessonRequirement {
  subjectId: string;
  lessonsPerWeek: number;
}

export interface GenerateTimetableInput {
  academicYearId?: string;
  termId?: string;
  gradeId: string;
  sectionId: string;
  streamId?: string | null;
  schoolDays?: string[];
  periodsPerDay?: number;
  subjectRequirements?: SubjectLessonRequirement[];
  replaceExistingDraftId?: string;
  createdById?: string;
  title?: string;
}

export interface GenerateTimetableResult {
  timetable: any;
  summary: {
    totalRequested: number;
    totalScheduled: number;
    schoolDays: string[];
    periodsPerDay: number;
    distribution: Array<{
      subjectId: string;
      subjectName: string;
      teacherName: string;
      lessonsScheduled: number;
      lessonsRequested: number;
    }>;
  };
  warnings: string[];
  validation: any;
}

/**
 * Automatic Timetable Generator
 * Uses a constraint-satisfaction algorithm with backtracking and fair-distribution heuristics
 * to generate complete clash-free timetables respecting teacher assignments, room capacities,
 * stream curriculum, breaks, and daily workload limits.
 */
export const generateTimetableAutomatic = async (
  params: GenerateTimetableInput
): Promise<GenerateTimetableResult> => {
  const {
    academicYearId,
    termId,
    gradeId,
    sectionId,
    streamId,
    periodsPerDay,
    replaceExistingDraftId,
    createdById,
    title,
  } = params;

  // 1. Verify Grade & Section exist
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { id: true, name: true },
  });
  if (!grade) {
    throw new Error('Selected grade not found.');
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true },
  });
  if (!section) {
    throw new Error('Selected section not found.');
  }

  let streamName: string | undefined;
  if (streamId) {
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      select: { id: true, name: true },
    });
    if (stream) streamName = stream.name;
  }

  // 2. Determine School Days and Instructional Periods
  const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const schoolDays = (params.schoolDays && params.schoolDays.length > 0)
    ? params.schoolDays.map((d) => d.toUpperCase()).filter((d) => VALID_DAYS.includes(d))
    : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  if (schoolDays.length === 0) {
    throw new Error('At least one valid school day must be selected.');
  }

  const allPeriods = await getPeriods();
  let instructionalPeriods = allPeriods.filter((p) => !p.isBreak);
  if (instructionalPeriods.length === 0) {
    throw new Error('No instructional periods defined. Please configure the Bell Schedule first.');
  }

  if (periodsPerDay && periodsPerDay > 0 && periodsPerDay < instructionalPeriods.length) {
    instructionalPeriods = instructionalPeriods.slice(0, periodsPerDay);
  }

  const totalAvailableSlots = schoolDays.length * instructionalPeriods.length;

  // 3. Resolve Subject Curriculum & Requirements
  let subjectReqs = params.subjectRequirements || [];

  // If no requirements specified, auto-populate from GradeSubject curriculum
  if (subjectReqs.length === 0) {
    const gradeSubjects = await prisma.gradeSubject.findMany({
      where: {
        gradeId,
        ...(streamId ? { OR: [{ streamId }, { streamId: null }] } : {}),
      },
      include: { subject: true },
    });

    if (gradeSubjects.length > 0) {
      // Divide available slots fairly among subjects
      const baseCount = Math.max(1, Math.floor(totalAvailableSlots / gradeSubjects.length));
      let remainder = totalAvailableSlots % gradeSubjects.length;

      subjectReqs = gradeSubjects.map((gs) => {
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder--;
        return {
          subjectId: gs.subjectId,
          lessonsPerWeek: Math.min(baseCount + extra, schoolDays.length),
        };
      });
    } else {
      // Fallback: check all subjects
      const subjects = await prisma.subject.findMany({ take: 8 });
      const baseCount = Math.max(1, Math.floor(totalAvailableSlots / (subjects.length || 1)));
      subjectReqs = subjects.map((s) => ({
        subjectId: s.id,
        lessonsPerWeek: Math.min(baseCount, schoolDays.length),
      }));
    }
  }

  // Filter out any 0-lesson items
  subjectReqs = subjectReqs.filter((r) => r.lessonsPerWeek > 0);

  if (subjectReqs.length === 0) {
    throw new Error(
      `No subjects configured for ${grade.name}${streamName ? ` (${streamName})` : ''}. Please assign subjects to this grade curriculum first.`
    );
  }

  const totalRequestedLessons = subjectReqs.reduce((sum, r) => sum + r.lessonsPerWeek, 0);
  if (totalRequestedLessons > totalAvailableSlots) {
    throw new Error(
      `Impossible schedule: Total requested lessons (${totalRequestedLessons}) exceeds available instructional slots (${totalAvailableSlots} slots: ${schoolDays.length} days × ${instructionalPeriods.length} periods). Please reduce lessons or add school days/periods.`
    );
  }

  // 4. Resolve Subject Details and Teacher Assignments
  const subjectMap = new Map<string, { id: string; name: string; code: string }>();
  const subjectRecords = await prisma.subject.findMany({
    where: { id: { in: subjectReqs.map((r) => r.subjectId) } },
  });
  for (const s of subjectRecords) {
    subjectMap.set(s.id, { id: s.id, name: s.name, code: s.code || s.name.slice(0, 4).toUpperCase() });
  }

  // Resolve assigned teachers for this grade/section/subject
  const subjectTeacherMap = new Map<string, { teacherId: string; teacherName: string; candidates: string[] }>();
  const missingTeacherSubjects: string[] = [];
  const warnings: string[] = [];

  for (const req of subjectReqs) {
    const subInfo = subjectMap.get(req.subjectId);
    const subName = subInfo?.name || '';

    // Search teacher assignment for this specific grade and section
    const assignment = await prisma.teacherAssignment.findFirst({
      where: {
        gradeId,
        sectionId,
        ...(academicYearId ? { OR: [{ academicYearId }, { academicYearId: null }] } : {}),
        ...(streamId ? { OR: [{ streamId }, { streamId: null }] } : {}),
        OR: [
          { subjectId: req.subjectId },
          ...(subName ? [{ subject: { equals: subName, mode: 'insensitive' as const } }] : []),
        ],
      },
      include: { teacher: true },
    });

    if (assignment?.teacher) {
      const candidates = await getTeacherIdentifierCandidates(assignment.teacher.id);
      subjectTeacherMap.set(req.subjectId, {
        teacherId: assignment.teacher.id,
        teacherName: assignment.teacher.name,
        candidates,
      });
    } else {
      // Check general grade-level assignment
      const gradeAssignment = await prisma.teacherAssignment.findFirst({
        where: {
          gradeId,
          ...(streamId ? { OR: [{ streamId }, { streamId: null }] } : {}),
          OR: [
            { subjectId: req.subjectId },
            ...(subName ? [{ subject: { equals: subName, mode: 'insensitive' as const } }] : []),
          ],
        },
        include: { teacher: true },
      });

      if (gradeAssignment?.teacher) {
        const candidates = await getTeacherIdentifierCandidates(gradeAssignment.teacher.id);
        subjectTeacherMap.set(req.subjectId, {
          teacherId: gradeAssignment.teacher.id,
          teacherName: gradeAssignment.teacher.name,
          candidates,
        });
        warnings.push(
          `Subject "${subName}" uses grade-wide teacher assignment (${gradeAssignment.teacher.name}) because no section-specific teacher is assigned.`
        );
      } else {
        // Find any teacher or mark missing
        missingTeacherSubjects.push(subName || req.subjectId);
      }
    }
  }

  if (missingTeacherSubjects.length > 0) {
    throw new Error(
      `Missing Teacher Assignments: No teacher is assigned to teach ${missingTeacherSubjects.join(', ')} for ${grade.name} - ${section.name}. Please assign teachers in the Academic Structure before running the automatic generator.`
    );
  }

  // 5. Query Existing Bookings (Clash Prevention across all other timetables)
  const existingOtherSlots = await prisma.timetableSlot.findMany({
    where: {
      isCancelled: false,
      timetable: {
        status: { in: ['PUBLISHED', 'VALIDATED', 'DRAFT'] },
        ...(replaceExistingDraftId ? { id: { not: replaceExistingDraftId } } : {}),
      },
      // Exclude this class's own previous/existing slots so it doesn't self-clash
      NOT: {
        AND: [
          { gradeId },
          { sectionId },
        ],
      },
    },
    select: {
      dayOfWeek: true,
      periodNumber: true,
      teacherId: true,
      substituteTeacherId: true,
      classroomId: true,
      gradeId: true,
      sectionId: true,
    },
  });

  const teacherBusySet = new Set<string>();
  const roomBusySet = new Set<string>();
  const sectionBusySet = new Set<string>();

  for (const s of existingOtherSlots) {
    const day = s.dayOfWeek.toUpperCase();
    if (s.teacherId) teacherBusySet.add(`${s.teacherId}_${day}_${s.periodNumber}`);
    if (s.substituteTeacherId) teacherBusySet.add(`${s.substituteTeacherId}_${day}_${s.periodNumber}`);
    if (s.classroomId) roomBusySet.add(`${s.classroomId}_${day}_${s.periodNumber}`);
    if (s.gradeId && s.sectionId) sectionBusySet.add(`${s.gradeId}_${s.sectionId}_${day}_${s.periodNumber}`);
  }

  // 6. Classrooms Pool
  const classrooms = await getClassrooms();
  const defaultRoom = classrooms.length > 0 ? classrooms[0] : null;

  // 7. Prepare Lesson Units to Schedule
  interface LessonUnit {
    subjectId: string;
    subjectName: string;
    teacherId: string;
    teacherName: string;
    teacherCandidates: string[];
    preferredRoomId: string | null;
  }

  const lessonUnits: LessonUnit[] = [];
  for (const req of subjectReqs) {
    const subInfo = subjectMap.get(req.subjectId);
    const teacherInfo = subjectTeacherMap.get(req.subjectId)!;

    // Pick appropriate room (Lab for science/computing, default room for general)
    let preferredRoom = defaultRoom ? defaultRoom.id : null;
    const isLabSubject = /science|physics|chemistry|biology|computer|ict|it/i.test(subInfo?.name || '');
    if (isLabSubject) {
      const lab = classrooms.find((c) => /lab/i.test(c.type || '') || /lab/i.test(c.name));
      if (lab) preferredRoom = lab.id;
    }

    for (let i = 0; i < req.lessonsPerWeek; i++) {
      lessonUnits.push({
        subjectId: req.subjectId,
        subjectName: subInfo?.name || 'Subject',
        teacherId: teacherInfo.teacherId,
        teacherName: teacherInfo.teacherName,
        teacherCandidates: teacherInfo.candidates,
        preferredRoomId: preferredRoom,
      });
    }
  }

  // Sort lesson units by most constrained first (Most Constrained Variable / MRV heuristic):
  // 1. Subjects with higher lesson counts
  // 2. Teachers with higher pre-existing commitments
  const teacherCommitmentCount = new Map<string, number>();
  for (const busyKey of Array.from(teacherBusySet)) {
    const tId = busyKey.split('_')[0];
    teacherCommitmentCount.set(tId, (teacherCommitmentCount.get(tId) || 0) + 1);
  }

  lessonUnits.sort((a, b) => {
    const aCommitments = teacherCommitmentCount.get(a.teacherId) || 0;
    const bCommitments = teacherCommitmentCount.get(b.teacherId) || 0;
    return bCommitments - aCommitments;
  });

  // 8. Define Candidate Grid Slots
  interface GridSlot {
    dayOfWeek: string;
    periodNumber: number;
    period: (typeof instructionalPeriods)[0];
  }

  const allGridSlots: GridSlot[] = [];
  for (const day of schoolDays) {
    for (const p of instructionalPeriods) {
      allGridSlots.push({
        dayOfWeek: day,
        periodNumber: p.periodNumber,
        period: p,
      });
    }
  }

  // 9. Constraint Backtracking Solver with Fair-Distribution Heuristics
  // Map of grid index => LessonUnit assigned
  const gridAssignment: Map<number, LessonUnit> = new Map();
  // Map of grid index => classroomId assigned
  const gridRoomAssignment: Map<number, string | null> = new Map();

  // Helper tracking structures
  // subjectId -> Map<dayOfWeek, count>
  const subjectDayCounts = new Map<string, Map<string, number>>();
  // teacherId -> Map<dayOfWeek, count>
  const teacherDayCounts = new Map<string, Map<string, number>>();

  for (const req of subjectReqs) {
    subjectDayCounts.set(req.subjectId, new Map());
  }
  for (const teacherInfo of Array.from(subjectTeacherMap.values())) {
    teacherDayCounts.set(teacherInfo.teacherId, new Map());
  }

  let totalIterations = 0;
  const MAX_ITERATIONS = 12000;

  const solve = (unitIndex: number): boolean => {
    totalIterations++;
    if (totalIterations > MAX_ITERATIONS) return false;
    if (unitIndex >= lessonUnits.length) return true; // All placed successfully!

    const unit = lessonUnits[unitIndex];
    const subDayMap = subjectDayCounts.get(unit.subjectId)!;
    const teachDayMap = teacherDayCounts.get(unit.teacherId)!;

    // Filter available grid slots that don't violate hard constraints
    const validCandidateIndices: { index: number; score: number }[] = [];

    for (let i = 0; i < allGridSlots.length; i++) {
      if (gridAssignment.has(i)) continue; // Already occupied in this draft

      const slot = allGridSlots[i];
      const slotDay = slot.dayOfWeek;
      const pNum = slot.periodNumber;

      // Hard Constraint: Section clash
      if (sectionBusySet.has(`${gradeId}_${sectionId}_${slotDay}_${pNum}`)) continue;

      // Hard Constraint: Teacher clash with other timetables
      const isTeacherClashing = unit.teacherCandidates.some((cId) =>
        teacherBusySet.has(`${cId}_${slotDay}_${pNum}`)
      );
      if (isTeacherClashing) continue;

      // Hard Constraint: Teacher clash within current draft timetable
      let teacherClashCurrent = false;
      for (const [assignedIdx, assignedUnit] of Array.from(gridAssignment.entries())) {
        const assignedSlot = allGridSlots[assignedIdx];
        if (assignedSlot.dayOfWeek === slotDay && assignedSlot.periodNumber === pNum) {
          if (assignedUnit.teacherId === unit.teacherId) {
            teacherClashCurrent = true;
            break;
          }
        }
      }
      if (teacherClashCurrent) continue;

      // Hard Constraint: Maximum lessons of same subject per day
      // If lessonsPerWeek <= schoolDays.length, max 1 lesson per day
      // If lessonsPerWeek > schoolDays.length, max 2 lessons per day
      const currentSubOnDay = subDayMap.get(slotDay) || 0;
      const maxSubLessonsPerDay = lessonUnits.filter((u) => u.subjectId === unit.subjectId).length <= schoolDays.length ? 1 : 2;
      if (currentSubOnDay >= maxSubLessonsPerDay) continue;

      // Calculate heuristic score (higher is better) for fair distribution:
      let score = 100;

      // Prefer days where subject is not yet taught
      if (currentSubOnDay === 0) {
        score += 50;
      } else {
        score -= 40;
      }

      // Balance teacher workload evenly across days
      const currentTeacherOnDay = teachDayMap.get(slotDay) || 0;
      score -= currentTeacherOnDay * 15;

      // Avoid putting the same teacher in 4 consecutive periods without a break
      let contiguousTeacher = 0;
      for (let offset = -2; offset <= 2; offset++) {
        if (offset === 0) continue;
        const neighborIdx = allGridSlots.findIndex(
          (s) => s.dayOfWeek === slotDay && s.periodNumber === pNum + offset
        );
        if (neighborIdx !== -1 && gridAssignment.get(neighborIdx)?.teacherId === unit.teacherId) {
          contiguousTeacher++;
        }
      }
      score -= contiguousTeacher * 10;

      validCandidateIndices.push({ index: i, score });
    }

    // Sort candidate slots by heuristic score descending
    validCandidateIndices.sort((a, b) => b.score - a.score);

    for (const { index } of validCandidateIndices) {
      const slot = allGridSlots[index];
      const slotDay = slot.dayOfWeek;

      // Pick best clash-free classroom
      let chosenRoomId: string | null = null;
      if (unit.preferredRoomId && !roomBusySet.has(`${unit.preferredRoomId}_${slotDay}_${slot.periodNumber}`)) {
        chosenRoomId = unit.preferredRoomId;
      } else {
        const freeRoom = classrooms.find((r) => !roomBusySet.has(`${r.id}_${slotDay}_${slot.periodNumber}`));
        if (freeRoom) chosenRoomId = freeRoom.id;
      }

      // Make tentative move
      gridAssignment.set(index, unit);
      gridRoomAssignment.set(index, chosenRoomId);
      subDayMap.set(slotDay, (subDayMap.get(slotDay) || 0) + 1);
      teachDayMap.set(slotDay, (teachDayMap.get(slotDay) || 0) + 1);

      // Recurse to next unit
      if (solve(unitIndex + 1)) return true;

      // Backtrack
      gridAssignment.delete(index);
      gridRoomAssignment.delete(index);
      subDayMap.set(slotDay, (subDayMap.get(slotDay) || 1) - 1);
      teachDayMap.set(slotDay, (teachDayMap.get(slotDay) || 1) - 1);
    }

    return false;
  };

  const solved = solve(0);

  if (!solved) {
    throw new Error(
      `Impossible Schedule Detected: The automatic generator could not find a clash-free timetable without teacher or section collisions. ` +
      `Potential causes: Teacher commitments in other classes on selected days or too many lessons requested for available periods. ` +
      `Recommendation: Expand school days, add periods in Bell Schedule, or adjust teacher assignments.`
    );
  }

  // 10. Persist Timetable and Slots (Draft Mode)
  const defaultTitle = `${grade.name} - ${section.name}${streamName ? ` (${streamName})` : ''} Timetable (Draft)`;

  const timetableRecord = await prisma.$transaction(async (tx) => {
    let tt: any;

    if (replaceExistingDraftId) {
      const existingDraft = await tx.timetable.findUnique({
        where: { id: replaceExistingDraftId },
      });
      if (existingDraft && existingDraft.status === 'DRAFT') {
        // Clear old slots of the draft
        await tx.timetableSlot.deleteMany({
          where: { timetableId: replaceExistingDraftId },
        });
        tt = await tx.timetable.update({
          where: { id: replaceExistingDraftId },
          data: {
            title: title || existingDraft.title,
            academicYearId: academicYearId || existingDraft.academicYearId,
            termId: termId || existingDraft.termId,
            gradeId,
            sectionId,
            streamId: streamId || null,
            updatedAt: new Date(),
          },
        });
      }
    }

    if (!tt) {
      tt = await tx.timetable.create({
        data: {
          title: title || defaultTitle,
          gradeId,
          sectionId,
          streamId: streamId || null,
          academicYearId: academicYearId || null,
          termId: termId || null,
          createdById: createdById || null,
          status: 'DRAFT',
          version: 1,
        },
      });
    }

    // Build slot records for insertion
    const slotsToInsert = Array.from(gridAssignment.entries()).map(([gridIdx, unit]) => {
      const slot = allGridSlots[gridIdx];
      const roomId = gridRoomAssignment.get(gridIdx);
      return {
        timetableId: tt.id,
        dayOfWeek: slot.dayOfWeek,
        periodId: slot.period.id,
        periodNumber: slot.periodNumber,
        startTime: slot.period.startTime,
        endTime: slot.period.endTime,
        subjectId: unit.subjectId,
        teacherId: unit.teacherId,
        classroomId: roomId,
        gradeId,
        sectionId,
        streamId: streamId || null,
        notes: 'Auto-generated by Timetable Generator',
      };
    });

    await tx.timetableSlot.createMany({
      data: slotsToInsert,
    });

    return tt;
  });

  // 11. Fetch Complete Generated Timetable & Run Full Validation
  const completeTimetable = await getTimetableById(timetableRecord.id);
  const validation = await validateTimetable(timetableRecord.id);

  // 12. Build Distribution Summary
  const distributionSummary = subjectReqs.map((req) => {
    const subInfo = subjectMap.get(req.subjectId);
    const teacherInfo = subjectTeacherMap.get(req.subjectId);
    const scheduledCount = Array.from(gridAssignment.values()).filter(
      (u) => u.subjectId === req.subjectId
    ).length;

    return {
      subjectId: req.subjectId,
      subjectName: subInfo?.name || 'Subject',
      teacherName: teacherInfo?.teacherName || 'Assigned Teacher',
      lessonsScheduled: scheduledCount,
      lessonsRequested: req.lessonsPerWeek,
    };
  });

  return {
    timetable: completeTimetable,
    summary: {
      totalRequested: totalRequestedLessons,
      totalScheduled: gridAssignment.size,
      schoolDays,
      periodsPerDay: instructionalPeriods.length,
      distribution: distributionSummary,
    },
    warnings,
    validation,
  };
};
