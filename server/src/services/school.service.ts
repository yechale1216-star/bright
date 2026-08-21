import prisma from '../config/db';
import * as settingsService from './settings.service';

export const getSingleSchool = async () => {
  const settings = await settingsService.getSettings();
  return {
    id: 'single-school',
    name: settings.school_name || 'Addis Hiwot School',
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

export const getGrades = async () => {
  return await prisma.grade.findMany({
    orderBy: { name: 'asc' },
  });
};

export const getSections = async () => {
  return await prisma.section.findMany({
    orderBy: { name: 'asc' },
  });
};

export const getStreams = async () => {
  return await prisma.stream.findMany({
    orderBy: { name: 'asc' },
  });
};

