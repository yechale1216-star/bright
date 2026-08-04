import prisma from '../config/db';
import { generateSchoolId } from '../utils/school-id';

export const createSchool = async (data: { name: string; id?: string }) => {
  const customId = await generateSchoolId();
  
  const school = await prisma.school.create({
    data: {
      id: data.id,
      name: data.name,
      schoolId: customId,
      settings: {
        create: {
          school_name: data.name,
          attendance_mode: 'session_based',
          attendance_ui_type: 'card_based'
        }
      }
    },
    include: {
      settings: true
    }
  });

  return school;
};

export const updateSchool = async (id: string, data: { name?: string }) => {
  const school = await prisma.school.update({
    where: { id },
    data: {
      name: data.name,
    },
    include: {
      settings: true
    }
  });

  // Also update school_name in settings for consistency
  if (data.name) {
    await prisma.schoolSettings.update({
      where: { schoolId: id },
      data: { school_name: data.name }
    });
  }

  return school;
};

export const getSchoolById = async (id: string) => {
  return await prisma.school.findUnique({
    where: { id },
    include: {
      settings: true,
    },
  });
};

export const getSchoolByCustomId = async (schoolId: string) => {
  return await prisma.school.findFirst({
    where: { schoolId },
    include: {
      settings: true,
    }
  });
};

export const getAllSchools = async () => {
  return await prisma.school.findMany({
    orderBy: { createdAt: 'desc' },
  });
};

export const getGrades = async (schoolId: string) => {
  return await prisma.grade.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' }
  });
};

export const getSections = async (schoolId: string) => {
  return await prisma.section.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' }
  });
};

export const getStreams = async (schoolId: string) => {
  return await prisma.stream.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' }
  });
};
