import prisma from '../config/db';
import {
  validateAllScheduleSettings,
  validateSessionSchedule,
  validateDailySchedule,
  ValidationError,
} from '../utils/schedule-validation';

export interface FixedStaffSession {
  id: 'morning' | 'afternoon';
  name: 'Morning' | 'Afternoon';
  startTime: string;
  endTime: string;
  lateGraceMinutes: number;
  earlyDepartureToleranceMinutes: number;
  absenceCutoffMinutes: number;
  absenceCutoffTime: string;
  earliestCheckinTime: string;
  latestCheckoutTime: string;
  allowCheckinAfterCutoff?: boolean;
  isActive: boolean;
}

export class ScheduleValidationError extends Error {
  public errors: ValidationError[];
  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = 'ScheduleValidationError';
    this.errors = errors;
  }
}

export const DEFAULT_FIXED_STAFF_SESSIONS: FixedStaffSession[] = [
  {
    id: 'morning',
    name: 'Morning',
    startTime: '08:00',
    endTime: '12:30',
    lateGraceMinutes: 15,
    earlyDepartureToleranceMinutes: 10,
    absenceCutoffMinutes: 90,
    absenceCutoffTime: '09:30',
    earliestCheckinTime: '06:00',
    latestCheckoutTime: '13:30',
    allowCheckinAfterCutoff: false,
    isActive: true,
  },
  {
    id: 'afternoon',
    name: 'Afternoon',
    startTime: '13:30',
    endTime: '17:00',
    lateGraceMinutes: 10,
    earlyDepartureToleranceMinutes: 10,
    absenceCutoffMinutes: 90,
    absenceCutoffTime: '15:00',
    earliestCheckinTime: '12:30',
    latestCheckoutTime: '18:30',
    allowCheckinAfterCutoff: false,
    isActive: true,
  },
];

function addMinutes(timeHHMM: string, minutes: number): string {
  const [h, m] = (timeHHMM || '08:00').split(':').map(Number);
  const totalMin = Math.max(0, Math.min(24 * 60 - 1, (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m) + minutes));
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getMinutesDiff(timeA: string, timeB: string): number {
  const [hA, mA] = (timeA || '08:00').split(':').map(Number);
  const [hB, mB] = (timeB || '08:00').split(':').map(Number);
  return (hA * 60 + mA) - (hB * 60 + mB);
}

/**
 * Validates, sanitizes, and locks staff sessions to exactly Morning and Afternoon.
 * Prevents arbitrary session creation, deletion, or renaming.
 */
export function sanitizeStaffSessions(rawSessions: any): FixedStaffSession[] {
  let parsed: any[] = [];
  if (rawSessions) {
    try {
      parsed = typeof rawSessions === 'string' ? JSON.parse(rawSessions) : rawSessions;
      if (!Array.isArray(parsed)) parsed = [];
    } catch (_) {
      parsed = [];
    }
  }

  const findRaw = (key: 'morning' | 'afternoon') => {
    return parsed.find(
      (s: any) =>
        s &&
        ((s.id && String(s.id).toLowerCase().trim() === key) ||
          (s.name && String(s.name).toLowerCase().trim() === key))
    );
  };

  const morningRaw = findRaw('morning');
  const afternoonRaw = findRaw('afternoon');

  const buildSession = (
    key: 'morning' | 'afternoon',
    name: 'Morning' | 'Afternoon',
    raw: any,
    fallback: FixedStaffSession
  ): FixedStaffSession => {
    const rawStartTime = raw?.startTime || raw?.start_time;
    const startTime = typeof rawStartTime === 'string' && /^\d{2}:\d{2}$/.test(rawStartTime)
      ? rawStartTime
      : fallback.startTime;

    const rawEndTime = raw?.endTime || raw?.end_time;
    const endTime = typeof rawEndTime === 'string' && /^\d{2}:\d{2}$/.test(rawEndTime)
      ? rawEndTime
      : fallback.endTime;

    const rawLateGrace = raw?.lateGraceMinutes ?? raw?.late_grace_minutes;
    const lateGraceMinutes = Number.isFinite(Number(rawLateGrace)) && Number(rawLateGrace) >= 0
      ? Math.min(180, Math.floor(Number(rawLateGrace)))
      : fallback.lateGraceMinutes;

    const rawEarlyTol = raw?.earlyDepartureToleranceMinutes ?? raw?.early_departure_tolerance_minutes;
    const earlyDepartureToleranceMinutes = Number.isFinite(Number(rawEarlyTol)) && Number(rawEarlyTol) >= 0
      ? Math.min(180, Math.floor(Number(rawEarlyTol)))
      : fallback.earlyDepartureToleranceMinutes;

    // Synchronize absence cutoff minutes & time authoritatively
    const rawCutoffMins = raw?.absenceCutoffMinutes ?? raw?.absence_cutoff_minutes;
    let absenceCutoffMinutes = Number.isFinite(Number(rawCutoffMins)) && Number(rawCutoffMins) >= 0
      ? Math.min(360, Math.floor(Number(rawCutoffMins)))
      : fallback.absenceCutoffMinutes;

    const rawCutoffTime = raw?.absenceCutoffTime || raw?.absence_cutoff_time;
    let absenceCutoffTime: string;
    if (typeof rawCutoffTime === 'string' && /^\d{2}:\d{2}$/.test(rawCutoffTime)) {
      absenceCutoffTime = rawCutoffTime;
      const diff = getMinutesDiff(absenceCutoffTime, startTime);
      if (diff > 0) {
        absenceCutoffMinutes = diff;
      } else {
        absenceCutoffTime = addMinutes(startTime, absenceCutoffMinutes);
      }
    } else {
      absenceCutoffTime = addMinutes(startTime, absenceCutoffMinutes);
    }

    const rawEarliest = raw?.earliestCheckinTime || raw?.earliestCheckInTime || raw?.earliest_checkin_time;
    const earliestCheckinTime = typeof rawEarliest === 'string' && /^\d{2}:\d{2}$/.test(rawEarliest)
      ? rawEarliest
      : fallback.earliestCheckinTime;

    const rawLatest = raw?.latestCheckoutTime || raw?.latestCheckOutTime || raw?.latest_checkout_time;
    const latestCheckoutTime = typeof rawLatest === 'string' && /^\d{2}:\d{2}$/.test(rawLatest)
      ? rawLatest
      : fallback.latestCheckoutTime;

    const allowCheckinAfterCutoff = (raw?.allowCheckinAfterCutoff ?? raw?.allow_checkin_after_cutoff) === true;

    return {
      id: key,
      name,
      startTime,
      endTime,
      lateGraceMinutes,
      earlyDepartureToleranceMinutes,
      absenceCutoffMinutes,
      absenceCutoffTime,
      earliestCheckinTime,
      latestCheckoutTime,
      allowCheckinAfterCutoff,
      isActive: (raw?.isActive ?? raw?.is_active) !== false,
    };
  };

  return [
    buildSession('morning', 'Morning', morningRaw, DEFAULT_FIXED_STAFF_SESSIONS[0]),
    buildSession('afternoon', 'Afternoon', afternoonRaw, DEFAULT_FIXED_STAFF_SESSIONS[1]),
  ];
}

const DEFAULT_SETTINGS = {
  school_name: '',
  school_phone: '',
  school_address: '',
  academic_year: '2017/2018 E.C.',
  calendar_type: 'ETHIOPIAN',
  attendance_mode: 'session_based',
  attendance_ui_type: 'card_based',
  attendance_threshold: 75,
  allow_late_mark: true,
  email_notifications: true,
  sms_notifications: false,
  notification_time: '16:00',
  school_logo: '',
  allow_attendance_editing: true,
  restrict_location: false,
  school_latitude: null,
  school_longitude: null,
  allowed_radius_meters: 200,
  allow_outside_attendance: true,
  // Staff Attendance Mode & Session Configuration
  staff_attendance_mode: 'daily',
  staff_sessions: DEFAULT_FIXED_STAFF_SESSIONS as any,
  // Staff Working Hours & Calendar Defaults
  staff_working_days: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
  staff_work_start_time: '08:00',
  staff_work_end_time: '17:00',
  staff_late_grace_minutes: 15,
  staff_early_checkout_tolerance_minutes: 15,
  staff_absence_cutoff_minutes: 120,
  staff_absence_cutoff_time: '10:00',
  staff_earliest_checkin_time: '06:00',
  staff_latest_checkout_time: '20:00',
  staff_face_required: true,
  staff_geo_required: true,
  allow_staff_checkin_after_cutoff: false,
};

const ALLOWED_SETTINGS_FIELDS = new Set([
  'school_name',
  'school_phone',
  'school_address',
  'academic_year',
  'calendar_type',
  'attendance_mode',
  'attendance_ui_type',
  'attendance_threshold',
  'allow_late_mark',
  'email_notifications',
  'sms_notifications',
  'notification_time',
  'school_logo',
  'allow_attendance_editing',
  'restrict_location',
  'school_latitude',
  'school_longitude',
  'allowed_radius_meters',
  'allow_outside_attendance',
  'staff_attendance_mode',
  'staff_sessions',
  'staff_working_days',
  'staff_work_start_time',
  'staff_work_end_time',
  'staff_late_grace_minutes',
  'staff_early_checkout_tolerance_minutes',
  'staff_absence_cutoff_minutes',
  'staff_absence_cutoff_time',
  'staff_earliest_checkin_time',
  'staff_latest_checkout_time',
  'staff_checkin_start',
  'staff_checkin_late',
  'staff_checkout_early',
  'staff_face_required',
  'staff_geo_required',
  'allow_staff_checkin_after_cutoff',
]);

export const getSettings = async (_schoolId?: string) => {
  let settings = await prisma.schoolSettings.findFirst();
  if (!settings) {
    settings = await prisma.schoolSettings.create({
      data: { id: 'singleton', ...DEFAULT_SETTINGS } as any,
    });
  }

  // Ensure staff_sessions is sanitized to fixed morning & afternoon sessions
  settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions) as any;

  // Ensure settings.academic_year reflects the currently active AcademicYear record
  const activeAY = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    select: { name: true }
  });

  if (activeAY && activeAY.name) {
    settings.academic_year = activeAY.name;
  }

  return settings;
};

export const updateSettings = async (_schoolId?: string, data?: any) => {
  const rawData: any = { ...data };

  // ── Authoritative Validation Before Persistence ──
  if (rawData.staff_sessions !== undefined) {
    const sessions = sanitizeStaffSessions(rawData.staff_sessions);
    const morning = sessions.find(s => s.id === 'morning') || sessions[0];
    const afternoon = sessions.find(s => s.id === 'afternoon') || sessions[1];
    
    const sessionValidation = validateSessionSchedule(morning, afternoon);
    if (!sessionValidation.isValid) {
      const firstError = sessionValidation.errors[0]?.message || 'Invalid session configuration';
      throw new ScheduleValidationError(firstError, sessionValidation.errors);
    }
    rawData.staff_sessions = sessions as any;
  }

  const hasDailyFields =
    rawData.staff_work_start_time !== undefined ||
    rawData.staff_work_end_time !== undefined ||
    rawData.staff_late_grace_minutes !== undefined ||
    rawData.staff_early_checkout_tolerance_minutes !== undefined ||
    rawData.staff_absence_cutoff_time !== undefined;

  if (hasDailyFields) {
    const existing = await prisma.schoolSettings.findFirst();
    const mergedDaily = {
      ...(existing || DEFAULT_SETTINGS),
      ...rawData,
    };
    const dailyValidation = validateDailySchedule(mergedDaily);
    if (!dailyValidation.isValid) {
      const firstError = dailyValidation.errors[0]?.message || 'Invalid daily schedule configuration';
      throw new ScheduleValidationError(firstError, dailyValidation.errors);
    }
  }

  const sanitizedData: any = {};
  for (const key of Object.keys(rawData)) {
    if (ALLOWED_SETTINGS_FIELDS.has(key)) {
      sanitizedData[key] = rawData[key];
    }
  }

  const settings: any = await prisma.schoolSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...DEFAULT_SETTINGS, ...sanitizedData } as any,
    update: sanitizedData,
  });

  settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions) as any;

  // Keep AcademicYear table in sync if academic_year changed
  if (data?.academic_year) {
    const ayName = String(data.academic_year).trim();
    if (ayName) {
      await prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          data: { isCurrent: false },
        });
        await tx.academicYear.upsert({
          where: { name: ayName },
          create: {
            name: ayName,
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            isCurrent: true,
          },
          update: { isCurrent: true },
        });
      });
    }
  }

  return settings;
};

