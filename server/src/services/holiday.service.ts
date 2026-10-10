import prisma from '../config/db';
import { normalizeStaffDate } from './staff-attendance.service';

export interface HolidayInput {
  name: string;
  description?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  type?: 'PUBLIC_HOLIDAY' | 'RELIGIOUS_HOLIDAY' | 'SCHOOL_HOLIDAY' | 'SPECIAL_CLOSURE' | 'OTHER';
  isActive?: boolean;
}

export const DAY_OF_WEEK_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

/**
 * Gets the day of week (e.g. 'MONDAY') for a date string/object in Africa/Addis_Ababa timezone
 */
export function getDayOfWeekInAddis(dateInput: string | Date): string {
  const { dateStr } = normalizeStaffDate(dateInput);
  const [year, month, day] = dateStr.split('-').map(Number);
  // UTC Date representation of the date string
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayIndex = dateObj.getUTCDay();
  return DAY_OF_WEEK_NAMES[dayIndex];
}

/**
 * Normalizes a time string (HH:MM) plus or minus minutes
 */
export function addMinutesToTime(timeHHMM: string, minutes: number): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  let totalMin = h * 60 + m + minutes;
  if (totalMin < 0) totalMin = 0;
  if (totalMin >= 24 * 60) totalMin = 24 * 60 - 1;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Retrieves all holidays with optional date filtering
 */
export async function getSchoolHolidays(
  _schoolId?: string,
  options?: {
    startDate?: string;
    endDate?: string;
    includeInactive?: boolean;
  }
) {
  const where: any = {};

  if (!options?.includeInactive) {
    where.isActive = true;
  }

  if (options?.startDate && options?.endDate) {
    const { startDate } = normalizeStaffDate(options.startDate);
    const { endDate } = normalizeStaffDate(options.endDate);
    where.OR = [
      {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    ];
  }

  return await (prisma as any).schoolHoliday.findMany({
    where,
    orderBy: { startDate: 'asc' },
  });
}

/**
 * Creates a new holiday or closure range
 */
export async function createSchoolHoliday(_schoolId?: string, data?: any) {
  const holidayData: HolidayInput = data;
  if (!holidayData.name || !holidayData.name.trim()) {
    throw new Error('Holiday / Closure name is required.');
  }

  const { startDate } = normalizeStaffDate(holidayData.startDate);
  const { endDate } = normalizeStaffDate(holidayData.endDate);

  if (startDate > endDate) {
    throw new Error('Holiday start date cannot be after end date.');
  }

  const existing = await (prisma as any).schoolHoliday.findFirst({
    where: {
      name: { equals: holidayData.name.trim(), mode: 'insensitive' },
      isActive: true,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (existing) {
    throw new Error(`An active holiday named '${holidayData.name}' already covers this date range.`);
  }

  return await (prisma as any).schoolHoliday.create({
    data: {
      name: holidayData.name.trim(),
      description: holidayData.description?.trim() || null,
      startDate,
      endDate,
      type: holidayData.type || 'PUBLIC_HOLIDAY',
      isActive: holidayData.isActive !== false,
    },
  });
}

/**
 * Updates a holiday record
 */
export async function updateSchoolHoliday(id: string, _schoolId?: string, data?: Partial<HolidayInput>) {
  const holiday = await (prisma as any).schoolHoliday.findFirst({
    where: { id },
  });

  if (!holiday) {
    throw new Error('Holiday record not found.');
  }

  const updateData: any = {};
  if (data?.name !== undefined) {
    if (!data.name.trim()) throw new Error('Holiday name cannot be empty.');
    updateData.name = data.name.trim();
  }
  if (data?.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data?.type !== undefined) updateData.type = data.type;
  if (data?.isActive !== undefined) updateData.isActive = data.isActive;

  if (data?.startDate !== undefined || data?.endDate !== undefined) {
    const sDate = data?.startDate ? normalizeStaffDate(data.startDate).startDate : holiday.startDate;
    const eDate = data?.endDate ? normalizeStaffDate(data.endDate).endDate : holiday.endDate;
    if (sDate > eDate) {
      throw new Error('Holiday start date cannot be after end date.');
    }
    updateData.startDate = sDate;
    updateData.endDate = eDate;
  }

  return await (prisma as any).schoolHoliday.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Deletes a holiday record
 */
export async function deleteSchoolHoliday(id: string, _schoolId?: string) {
  const holiday = await (prisma as any).schoolHoliday.findFirst({
    where: { id },
  });

  if (!holiday) {
    throw new Error('Holiday record not found.');
  }

  return await (prisma as any).schoolHoliday.delete({
    where: { id },
  });
}

/**
 * Formats a user-facing reason string from working-day info.
 * Examples:
 *   "Weekend — Saturday"
 *   "Public Holiday — Ethiopian New Year"
 *   "School Holiday — Spring Break"
 *   "Non-working day — Tuesday"
 */
export function buildNonWorkingDayReason(info: {
  isHoliday: boolean;
  isWeekend: boolean;
  dayOfWeek: string;
  holidayName?: string;
  holidayType?: string;
}): string {
  if (info.isHoliday && info.holidayName) {
    const typeLabel: Record<string, string> = {
      PUBLIC_HOLIDAY: 'Public Holiday',
      RELIGIOUS_HOLIDAY: 'Religious Holiday',
      SCHOOL_HOLIDAY: 'School Holiday',
      SPECIAL_CLOSURE: 'School Closure',
      OTHER: 'Non-working day',
    };
    const prefix = (info.holidayType && typeLabel[info.holidayType]) || 'Holiday';
    return `${prefix} — ${info.holidayName}`;
  }
  if (info.isWeekend) {
    const day = info.dayOfWeek.charAt(0) + info.dayOfWeek.slice(1).toLowerCase();
    return `Weekend — ${day}`;
  }
  const day = info.dayOfWeek.charAt(0) + info.dayOfWeek.slice(1).toLowerCase();
  return `Non-working day — ${day}`;
}

/**
 * Determines whether a given date is a working day for Bright Path according to:
 * 1. Configured staff working days in SchoolSettings (e.g. MONDAY-FRIDAY).
 * 2. Active SchoolHoliday / Non-working days in the database.
 */
export async function isDateWorkingDay(
  _schoolId?: string,
  dateInput?: string | Date,
  cachedSettings?: any
): Promise<{
  isWorkingDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  dayOfWeek: string;
  holidayName?: string;
  holidayType?: string;
  reason?: string;
  displayReason?: string;
  workingDaysList: string[];
}> {
  const { dateStr, startDate } = normalizeStaffDate(dateInput);
  const dayOfWeek = getDayOfWeekInAddis(dateStr);

  const settings =
    cachedSettings ||
    (await prisma.schoolSettings.findFirst());

  const configuredDaysStr = settings?.staff_working_days || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY';
  const workingDaysList = configuredDaysStr
    .split(',')
    .map((d: string) => d.trim().toUpperCase())
    .filter(Boolean);

  // 1. Check if date falls in any active SchoolHoliday / Special Closure
  const activeHoliday = await (prisma as any).schoolHoliday.findFirst({
    where: {
      isActive: true,
      startDate: { lte: startDate },
      endDate: { gte: startDate },
    },
  });

  if (activeHoliday) {
    const isWeekend = dayOfWeek === 'SATURDAY' || dayOfWeek === 'SUNDAY';
    const info = {
      isWorkingDay: false,
      isHoliday: true,
      isWeekend,
      dayOfWeek,
      holidayName: activeHoliday.name as string,
      holidayType: activeHoliday.type as string,
      workingDaysList,
    };
    const displayReason = buildNonWorkingDayReason(info);
    return {
      ...info,
      reason: `Holiday: ${activeHoliday.name}`,
      displayReason,
    };
  }

  // 2. Check if day of week is configured as a working day
  const isScheduledDay = workingDaysList.includes(dayOfWeek);

  if (!isScheduledDay) {
    const isWeekend = dayOfWeek === 'SATURDAY' || dayOfWeek === 'SUNDAY';
    const info = {
      isWorkingDay: false,
      isHoliday: false,
      isWeekend,
      dayOfWeek,
      workingDaysList,
    };
    const displayReason = buildNonWorkingDayReason(info);
    return {
      ...info,
      reason: isWeekend ? 'Weekend (Non-Working Day)' : `${dayOfWeek} (Scheduled Non-Working Day)`,
      displayReason,
    };
  }

  return {
    isWorkingDay: true,
    isHoliday: false,
    isWeekend: false,
    dayOfWeek,
    workingDaysList,
  };
}
