import prisma from '../config/db';
import * as settingsService from './settings.service';

export const getSingleSchool = async () => {
  const settings = await settingsService.getSettings();
  return {
    id: 'single-school',
    name: settings.school_name || 'Bright Path',
    schoolId: 'SCH-0001',
    settings,
  };
};

export const getSchoolById = async (_id: string) => {
  return await getSingleSchool();
};

export const getSchoolByCustomId = async (_schoolId: string) => {
  return await getSingleSchool();
};

export const getAllSchools = async () => {
  return [await getSingleSchool()];
};

export const createSchool = async (data: { name: string }) => {
  const settings = await settingsService.updateSettings(undefined, { school_name: data.name });
  return {
    id: 'single-school',
    name: settings.school_name || data.name,
    schoolId: 'SCH-0001',
    settings,
  };
};

export const updateSchool = async (_id: string, data: { name?: string }) => {
  if (data.name) {
    await settingsService.updateSettings(undefined, { school_name: data.name });
  }
  return await getSingleSchool();
};

// ─── Grades ─────────────────────────────────────────────────────────────────
export const getGrades = async () => {
  return await prisma.grade.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createGrade = async (data: { name: string }) => {
  const trimmedName = data.name?.trim();
  if (!trimmedName) throw new Error('Grade name is required');
  const existing = await prisma.grade.findUnique({ where: { name: trimmedName } });
  if (existing) throw new Error(`Grade "${trimmedName}" already exists`);

  return await prisma.grade.create({
    data: {
      name: trimmedName,
    },
  });
};

export const updateGrade = async (id: string, data: { name?: string }) => {
  const existing = await prisma.grade.findUnique({ where: { id } });
  if (!existing) throw new Error('Grade not found');

  return await prisma.grade.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
    },
  });
};

export const deleteGrade = async (id: string) => {
  const studentCount = await prisma.student.count({ where: { gradeId: id } });
  if (studentCount > 0) {
    throw new Error(`Cannot delete grade: ${studentCount} active students are currently enrolled in it.`);
  }

  return await prisma.grade.delete({ where: { id } });
};

// ─── Sections ───────────────────────────────────────────────────────────────
export const getSections = async (gradeId?: string, streamId?: string) => {
  try {
    const where: any = {};
    if (gradeId && gradeId !== 'ALL' && gradeId !== 'all') {
      where.gradeId = gradeId;
    }
    if (streamId && streamId !== 'ALL' && streamId !== 'all') {
      if (streamId === 'NONE' || streamId === 'none') {
        where.streamId = null;
      } else {
        where.streamId = streamId;
      }
    }

    return await prisma.section.findMany({
      where,
      include: {
        grade: { select: { id: true, name: true } },
        stream: { select: { id: true, name: true } },
        _count: {
          select: {
            students: true,
            assignments: true,
            timetables: true,
          },
        },
      },
      orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
    });
  } catch (err) {
    console.warn('[getSections] Failed to fetch sections with filters:', err);
    return await prisma.section.findMany({
      include: {
        grade: { select: { id: true, name: true } },
        stream: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
};

// ─── Teachers ───────────────────────────────────────────────────────────────
export const getTeachers = async () => {
  return await prisma.teacher.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createSection = async (data: { name: string; gradeId: string; streamId?: string }) => {
  const trimmedName = data.name?.trim();
  if (!trimmedName) throw new Error('Section name is required');
  if (!data.gradeId) throw new Error('Grade Level is mandatory to create a section');

  const grade = await prisma.grade.findUnique({ where: { id: data.gradeId } });
  if (!grade) throw new Error('Selected grade not found');

  const gradeName = (grade.name || '').toLowerCase();
  const isSeniorSecondary = gradeName.includes('11') || gradeName.includes('12');

  let streamId: string | null = null;
  if (isSeniorSecondary) {
    if (!data.streamId) {
      throw new Error(`Academic Stream (Natural Science or Social Science) is mandatory for ${grade.name}`);
    }
    const stream = await prisma.stream.findUnique({ where: { id: data.streamId } });
    if (!stream) throw new Error('Selected stream not found');
    streamId = stream.id;
  } else {
    streamId = null;
  }

  // Check duplicate section name within this grade and stream
  const existing = await prisma.section.findFirst({
    where: {
      gradeId: data.gradeId,
      streamId: streamId,
      name: { equals: trimmedName, mode: 'insensitive' },
    },
  });

  if (existing) {
    throw new Error(`Section "${trimmedName}" already exists for this grade${streamId ? ' and stream' : ''}`);
  }

  return await prisma.section.create({
    data: {
      name: trimmedName,
      gradeId: data.gradeId,
      streamId,
    },
    include: {
      grade: true,
      stream: true,
    },
  });
};

export const updateSection = async (id: string, data: { name?: string; gradeId?: string; streamId?: string }) => {
  const existing = await prisma.section.findUnique({ where: { id } });
  if (!existing) throw new Error('Section not found');

  const targetGradeId = data.gradeId || existing.gradeId;
  const grade = await prisma.grade.findUnique({ where: { id: targetGradeId } });
  if (!grade) throw new Error('Target grade not found');

  const gradeName = (grade.name || '').toLowerCase();
  const isSeniorSecondary = gradeName.includes('11') || gradeName.includes('12');

  let targetStreamId = existing.streamId;
  if (isSeniorSecondary) {
    const candidateStreamId = data.streamId !== undefined ? data.streamId : existing.streamId;
    if (!candidateStreamId) {
      throw new Error(`Academic Stream is required for ${grade.name}`);
    }
    targetStreamId = candidateStreamId;
  } else {
    targetStreamId = null;
  }

  const targetName = (data.name ? data.name.trim() : existing.name);

  // Check duplicate
  const duplicate = await prisma.section.findFirst({
    where: {
      id: { not: id },
      gradeId: targetGradeId,
      streamId: targetStreamId,
      name: { equals: targetName, mode: 'insensitive' },
    },
  });
  if (duplicate) {
    throw new Error(`Section "${targetName}" already exists for this grade and stream`);
  }

  return await prisma.section.update({
    where: { id },
    data: {
      name: targetName,
      gradeId: targetGradeId,
      streamId: targetStreamId,
    },
    include: {
      grade: true,
      stream: true,
    },
  });
};

export const deleteSection = async (id: string) => {
  const [studentCount, assignmentCount, timetableCount, assessmentCount] = await Promise.all([
    prisma.student.count({ where: { sectionId: id } }),
    prisma.teacherAssignment.count({ where: { sectionId: id } }),
    prisma.timetable.count({ where: { sectionId: id } }),
    prisma.assessment.count({ where: { sectionId: id } }),
  ]);

  if (studentCount > 0) {
    throw new Error(`Cannot delete section: ${studentCount} active students are currently enrolled in it.`);
  }
  if (assignmentCount > 0) {
    throw new Error(`Cannot delete section: ${assignmentCount} teacher assignments are currently attached to it.`);
  }
  if (timetableCount > 0) {
    throw new Error(`Cannot delete section: ${timetableCount} timetables are currently assigned to it.`);
  }
  if (assessmentCount > 0) {
    throw new Error(`Cannot delete section: ${assessmentCount} assessments are currently recorded for it.`);
  }

  return await prisma.section.delete({ where: { id } });
};

// ─── Streams ────────────────────────────────────────────────────────────────
export const getStreams = async () => {
  return await prisma.stream.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createStream = async (data: { name: string }) => {
  const trimmedName = data.name?.trim();
  if (!trimmedName) throw new Error('Stream name is required');
  const existing = await prisma.stream.findUnique({ where: { name: trimmedName } });
  if (existing) throw new Error(`Stream "${trimmedName}" already exists`);

  return await prisma.stream.create({
    data: { name: trimmedName },
  });
};

export const updateStream = async (id: string, data: { name?: string }) => {
  const existing = await prisma.stream.findUnique({ where: { id } });
  if (!existing) throw new Error('Stream not found');

  return await prisma.stream.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
    },
  });
};

export const deleteStream = async (id: string) => {
  return await prisma.stream.delete({ where: { id } });
};

// ─── Subjects ───────────────────────────────────────────────────────────────
export const getSubjects = async () => {
  return await prisma.subject.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createSubject = async (data: {
  name: string;
  code: string;
  department?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}) => {
  const trimmedName = data.name?.trim();
  const trimmedCode = data.code?.trim().toUpperCase();
  if (!trimmedName) throw new Error('Subject name is required');
  if (!trimmedCode) throw new Error('Subject code is required');

  const existingCode = await prisma.subject.findUnique({ where: { code: trimmedCode } });
  if (existingCode) throw new Error(`Subject with code "${trimmedCode}" already exists`);

  return await prisma.subject.create({
    data: {
      name: trimmedName,
      code: trimmedCode,
      department: data.department?.trim() || null,
      color: data.color || '#3b82f6',
      description: data.description?.trim() || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });
};

export const updateSubject = async (
  id: string,
  data: {
    name?: string;
    code?: string;
    department?: string;
    color?: string;
    description?: string;
    isActive?: boolean;
  }
) => {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing) throw new Error('Subject not found');

  if (data.code && data.code.trim().toUpperCase() !== existing.code) {
    const codeTaken = await prisma.subject.findUnique({ where: { code: data.code.trim().toUpperCase() } });
    if (codeTaken) throw new Error(`Subject with code "${data.code}" already exists`);
  }

  return await prisma.subject.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
      ...(data.department !== undefined ? { department: data.department?.trim() || null } : {}),
      ...(data.color ? { color: data.color } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
};

export const deleteSubject = async (id: string) => {
  const assignmentCount = await prisma.teacherAssignment.count({ where: { subjectId: id } });
  if (assignmentCount > 0) {
    throw new Error(`Cannot delete subject: ${assignmentCount} teacher assignments are currently linked to it.`);
  }

  return await prisma.subject.delete({ where: { id } });
};

// ─── Grade Subjects (Curriculum Allocation) ──────────────────────────────────
export const getGradeSubjects = async (filter?: {
  gradeId?: string;
  streamId?: string;
  sectionId?: string;
}) => {
  const where: any = {};
  if (filter?.gradeId) where.gradeId = filter.gradeId;
  if (filter?.streamId !== undefined) {
    where.streamId = filter.streamId ? filter.streamId : null;
  }
  if (filter?.sectionId !== undefined) {
    where.sectionId = filter.sectionId ? filter.sectionId : null;
  }

  return await prisma.gradeSubject.findMany({
    where,
    orderBy: [
      { grade: { name: 'asc' } },
      { subject: { name: 'asc' } },
    ],
    include: {
      grade: true,
      stream: true,
      section: true,
      subject: true,
    },
  });
};

export const assignSubjectsToGrade = async (data: {
  gradeId: string;
  streamId?: string | null;
  sectionId?: string | null;
  subjectIds: string[];
}) => {
  if (!data.gradeId) throw new Error('Grade is required');
  if (!data.subjectIds || !Array.isArray(data.subjectIds) || data.subjectIds.length === 0) {
    throw new Error('At least one subject must be selected');
  }

  const grade = await prisma.grade.findUnique({ where: { id: data.gradeId } });
  if (!grade) throw new Error('Grade not found');

  const isGrade11or12 = /\b(11|12)\b/.test(grade.name);
  if (isGrade11or12 && !data.streamId) {
    throw new Error('Stream selection (Natural Science or Social Science) is required for Grades 11 and 12');
  }

  const streamId = isGrade11or12 ? data.streamId : (data.streamId || null);
  const sectionId = data.sectionId || null;

  if (streamId) {
    const stream = await prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) throw new Error('Stream not found');
  }

  const results = [];
  for (const subjectId of data.subjectIds) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) continue;

    // Check if already assigned to prevent duplicates
    const existing = await prisma.gradeSubject.findFirst({
      where: {
        gradeId: data.gradeId,
        streamId: streamId,
        sectionId: sectionId,
        subjectId: subjectId,
      },
    });

    if (!existing) {
      const created = await prisma.gradeSubject.create({
        data: {
          gradeId: data.gradeId,
          streamId: streamId,
          sectionId: sectionId,
          subjectId: subjectId,
        },
        include: {
          grade: true,
          stream: true,
          section: true,
          subject: true,
        },
      });
      results.push(created);
    } else {
      results.push(existing);
    }
  }

  return results;
};

export const deleteGradeSubject = async (id: string) => {
  const existing = await prisma.gradeSubject.findUnique({ where: { id } });
  if (!existing) throw new Error('Grade subject assignment not found');

  return await prisma.gradeSubject.delete({ where: { id } });
};

export const bulkRemoveGradeSubjects = async (data: {
  gradeId: string;
  streamId?: string | null;
  sectionId?: string | null;
  subjectIds: string[];
}) => {
  return await prisma.gradeSubject.deleteMany({
    where: {
      gradeId: data.gradeId,
      streamId: data.streamId || null,
      sectionId: data.sectionId || null,
      subjectId: { in: data.subjectIds },
    },
  });
};

