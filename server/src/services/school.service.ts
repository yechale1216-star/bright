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
export const getSections = async (gradeId?: string) => {
  return await prisma.section.findMany({
    where: gradeId ? ({ gradeId } as any) : undefined,
    orderBy: { name: 'asc' },
  });
};

export const createSection = async (data: { name: string }) => {
  const trimmedName = data.name?.trim();
  if (!trimmedName) throw new Error('Section name is required');
  const existing = await prisma.section.findUnique({ where: { name: trimmedName } });
  if (existing) throw new Error(`Section "${trimmedName}" already exists`);

  return await prisma.section.create({
    data: { name: trimmedName },
  });
};

export const updateSection = async (id: string, data: { name?: string }) => {
  const existing = await prisma.section.findUnique({ where: { id } });
  if (!existing) throw new Error('Section not found');

  return await prisma.section.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
    },
  });
};

export const deleteSection = async (id: string) => {
  const studentCount = await prisma.student.count({ where: { sectionId: id } });
  if (studentCount > 0) {
    throw new Error(`Cannot delete section: ${studentCount} active students are currently assigned to it.`);
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
