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
  school_name: 'Bright Path',
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
  grade_system: 'standard',
  email_api_key: '',
  email_from_domain: 'smartattenadacetracker.app',
  // Staff Attendance Mode & Session Configuration
  staff_attendance_mode: 'daily',
  attendanceModeSetting: 'DAILY',
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
  'grade_system',
  'email_api_key',
  'email_from_domain',
  'staff_attendance_mode',
  'attendanceModeSetting',
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

export const ensureSingletonSettings = async () => {
  const all = await prisma.schoolSettings.findMany({
    orderBy: { updatedAt: 'desc' }
  });
  if (all.length > 1) {
    // Keep the most recently updated record, preferably 'singleton' if it's latest
    const primary = all[0];
    const duplicates = all.slice(1);
    for (const dup of duplicates) {
      try {
        await prisma.schoolSettings.delete({ where: { id: dup.id } });
      } catch (err) {
        console.warn(`[Settings] Failed to prune duplicate settings row ${dup.id}:`, err);
      }
    }
    return primary;
  }
  if (all.length === 1) {
    return all[0];
  }
  return await prisma.schoolSettings.create({
    data: { id: 'singleton', ...DEFAULT_SETTINGS } as any,
  });
};

export const getSettings = async (_schoolId?: string) => {
  let settings = await ensureSingletonSettings();

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

  // Ensure attendanceModeSetting is set and synced
  if (!settings.attendanceModeSetting) {
    const raw = String(settings.staff_attendance_mode || 'daily').toLowerCase();
    if (raw === 'session_based' || raw === 'session') {
      settings.attendanceModeSetting = 'SESSION';
    } else if (raw === 'both') {
      settings.attendanceModeSetting = 'BOTH';
    } else {
      settings.attendanceModeSetting = 'DAILY';
    }
  }

  return settings;
};

export const updateSettings = async (_schoolId?: string, data?: any) => {
  const rawData: any = { ...data };

  // Normalize camelCase fields to snake_case if passed
  if (rawData.schoolName !== undefined && rawData.school_name === undefined) rawData.school_name = rawData.schoolName;
  if (rawData.schoolPhone !== undefined && rawData.school_phone === undefined) rawData.school_phone = rawData.schoolPhone;
  if (rawData.schoolAddress !== undefined && rawData.school_address === undefined) rawData.school_address = rawData.schoolAddress;
  if (rawData.academicYear !== undefined && rawData.academic_year === undefined) rawData.academic_year = rawData.academicYear;
  if (rawData.attendanceMode !== undefined && rawData.attendance_mode === undefined) rawData.attendance_mode = rawData.attendanceMode;
  if (rawData.attendanceUiType !== undefined && rawData.attendance_ui_type === undefined) rawData.attendance_ui_type = rawData.attendanceUiType;
  if (rawData.attendanceThreshold !== undefined && rawData.attendance_threshold === undefined) rawData.attendance_threshold = rawData.attendanceThreshold;
  if (rawData.allowLateMark !== undefined && rawData.allow_late_mark === undefined) rawData.allow_late_mark = rawData.allowLateMark;
  if (rawData.emailNotifications !== undefined && rawData.email_notifications === undefined) rawData.email_notifications = rawData.emailNotifications;
  if (rawData.smsNotifications !== undefined && rawData.sms_notifications === undefined) rawData.sms_notifications = rawData.smsNotifications;
  if (rawData.notificationTime !== undefined && rawData.notification_time === undefined) rawData.notification_time = rawData.notificationTime;
  if (rawData.schoolLogo !== undefined && rawData.school_logo === undefined) rawData.school_logo = rawData.schoolLogo;
  if (rawData.allowAttendanceEditing !== undefined && rawData.allow_attendance_editing === undefined) rawData.allow_attendance_editing = rawData.allowAttendanceEditing;
  if (rawData.restrictLocation !== undefined && rawData.restrict_location === undefined) rawData.restrict_location = rawData.restrictLocation;
  if (rawData.schoolLatitude !== undefined && rawData.school_latitude === undefined) rawData.school_latitude = rawData.schoolLatitude;
  if (rawData.schoolLongitude !== undefined && rawData.school_longitude === undefined) rawData.school_longitude = rawData.schoolLongitude;
  if (rawData.allowedRadiusMeters !== undefined && rawData.allowed_radius_meters === undefined) rawData.allowed_radius_meters = rawData.allowedRadiusMeters;
  if (rawData.allowOutsideAttendance !== undefined && rawData.allow_outside_attendance === undefined) rawData.allow_outside_attendance = rawData.allowOutsideAttendance;
  if (rawData.gradeSystem !== undefined && rawData.grade_system === undefined) rawData.grade_system = rawData.gradeSystem;
  if (rawData.emailApiKey !== undefined && rawData.email_api_key === undefined) rawData.email_api_key = rawData.emailApiKey;
  if (rawData.emailFromDomain !== undefined && rawData.email_from_domain === undefined) rawData.email_from_domain = rawData.emailFromDomain;
  if (rawData.calendarType !== undefined && rawData.calendar_type === undefined) rawData.calendar_type = rawData.calendarType;
  if (rawData.calendarPreference !== undefined && rawData.calendar_type === undefined) rawData.calendar_type = rawData.calendarPreference;

  // Synchronize attendanceModeSetting and staff_attendance_mode
  const rawStaffMode = rawData.attendanceModeSetting ?? rawData.attendance_mode_setting ?? rawData.staffAttendanceMode ?? rawData.staff_attendance_mode;
  if (rawStaffMode !== undefined) {
    const upper = String(rawStaffMode).trim().toUpperCase();
    if (upper === 'SESSION' || upper === 'SESSION_BASED') {
      rawData.attendanceModeSetting = 'SESSION';
      rawData.staff_attendance_mode = 'session_based';
    } else if (upper === 'BOTH') {
      rawData.attendanceModeSetting = 'BOTH';
      rawData.staff_attendance_mode = 'both';
    } else {
      rawData.attendanceModeSetting = 'DAILY';
      rawData.staff_attendance_mode = 'daily';
    }
  }
  if (rawData.staffSessions !== undefined && rawData.staff_sessions === undefined) rawData.staff_sessions = rawData.staffSessions;
  if (rawData.staffWorkingDays !== undefined && rawData.staff_working_days === undefined) rawData.staff_working_days = rawData.staffWorkingDays;
  if (rawData.staffWorkStartTime !== undefined && rawData.staff_work_start_time === undefined) rawData.staff_work_start_time = rawData.staffWorkStartTime;
  if (rawData.staffWorkEndTime !== undefined && rawData.staff_work_end_time === undefined) rawData.staff_work_end_time = rawData.staffWorkEndTime;
  if (rawData.staffLateGraceMinutes !== undefined && rawData.staff_late_grace_minutes === undefined) rawData.staff_late_grace_minutes = rawData.staffLateGraceMinutes;
  if (rawData.staffEarlyCheckoutToleranceMinutes !== undefined && rawData.staff_early_checkout_tolerance_minutes === undefined) rawData.staff_early_checkout_tolerance_minutes = rawData.staffEarlyCheckoutToleranceMinutes;
  if (rawData.staffAbsenceCutoffMinutes !== undefined && rawData.staff_absence_cutoff_minutes === undefined) rawData.staff_absence_cutoff_minutes = rawData.staffAbsenceCutoffMinutes;
  if (rawData.staffAbsenceCutoffTime !== undefined && rawData.staff_absence_cutoff_time === undefined) rawData.staff_absence_cutoff_time = rawData.staffAbsenceCutoffTime;
  if (rawData.staffEarliestCheckinTime !== undefined && rawData.staff_earliest_checkin_time === undefined) rawData.staff_earliest_checkin_time = rawData.staffEarliestCheckinTime;
  if (rawData.staffLatestCheckoutTime !== undefined && rawData.staff_latest_checkout_time === undefined) rawData.staff_latest_checkout_time = rawData.staffLatestCheckoutTime;
  if (rawData.staffFaceRequired !== undefined && rawData.staff_face_required === undefined) rawData.staff_face_required = rawData.staffFaceRequired;
  if (rawData.staffGeoRequired !== undefined && rawData.staff_geo_required === undefined) rawData.staff_geo_required = rawData.staffGeoRequired;
  if (rawData.allowStaffCheckinAfterCutoff !== undefined && rawData.allow_staff_checkin_after_cutoff === undefined) rawData.allow_staff_checkin_after_cutoff = rawData.allowStaffCheckinAfterCutoff;

  // Normalize calendar_type to standard string
  if (rawData.calendar_type !== undefined) {
    const cal = String(rawData.calendar_type).trim().toUpperCase();
    rawData.calendar_type = cal.includes('GREGORIAN') ? 'GREGORIAN' : 'ETHIOPIAN';
  }

  // Normalize numeric types
  if (rawData.attendance_threshold !== undefined && rawData.attendance_threshold !== null && rawData.attendance_threshold !== '') {
    rawData.attendance_threshold = Number(rawData.attendance_threshold);
  }
  if (rawData.school_latitude !== undefined && rawData.school_latitude !== null && rawData.school_latitude !== '') {
    rawData.school_latitude = Number(rawData.school_latitude);
  } else if (rawData.school_latitude === '') {
    rawData.school_latitude = null;
  }
  if (rawData.school_longitude !== undefined && rawData.school_longitude !== null && rawData.school_longitude !== '') {
    rawData.school_longitude = Number(rawData.school_longitude);
  } else if (rawData.school_longitude === '') {
    rawData.school_longitude = null;
  }
  if (rawData.allowed_radius_meters !== undefined && rawData.allowed_radius_meters !== null && rawData.allowed_radius_meters !== '') {
    rawData.allowed_radius_meters = Number(rawData.allowed_radius_meters);
  }

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

  const current = await ensureSingletonSettings();

  if (hasDailyFields) {
    const mergedDaily = {
      ...(current || DEFAULT_SETTINGS),
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

  const settings: any = await prisma.schoolSettings.update({
    where: { id: current.id },
    data: sanitizedData,
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

export const resetSettings = async (_schoolId?: string) => {
  const current = await ensureSingletonSettings();
  const settings: any = await prisma.schoolSettings.update({
    where: { id: current.id },
    data: { ...DEFAULT_SETTINGS },
  });
  settings.staff_sessions = sanitizeStaffSessions(settings.staff_sessions) as any;
  return settings;
};


