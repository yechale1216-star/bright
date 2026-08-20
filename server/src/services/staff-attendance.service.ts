import prisma from '../config/db';
import { validateGeofence } from './attendance.service';
import { isDateWorkingDay, addMinutesToTime } from './holiday.service';
import { formatCivilTime } from '../utils/ethiopian-time';

/**
 * Normalizes date to UTC midnight for Africa/Addis_Ababa or standard date string
 */
export const normalizeStaffDate = (dateInput?: any): { dateStr: string; startDate: Date; endDate: Date } => {
  let dateStr: string;
  if (!dateInput) {
    dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.split('T')[0];
  } else if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split('T')[0];
  } else {
    dateStr = new Date(dateInput).toISOString().split('T')[0];
  }
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);
  return { dateStr, startDate, endDate };
};

/**
 * Helper to check if a time (HH:MM) is after another time (HH:MM)
 */
export function isTimeAfter(currentHHMM: string, targetHHMM: string): boolean {
  const [cH, cM] = currentHHMM.split(':').map(Number);
  const [tH, tM] = targetHHMM.split(':').map(Number);
  if (cH > tH) return true;
  if (cH === tH && cM > tM) return true;
  return false;
}

/**
 * Helper to check if a time (HH:MM) is before another time (HH:MM)
 */
export function isTimeBefore(currentHHMM: string, targetHHMM: string): boolean {
  const [cH, cM] = currentHHMM.split(':').map(Number);
  const [tH, tM] = targetHHMM.split(':').map(Number);
  if (cH < tH) return true;
  if (cH === tH && cM < tM) return true;
  return false;
}

/**
 * Dynamically computes staff working schedule cutoffs from school settings with runtime safety checks.
 */
export function computeWorkingScheduleThresholds(settings?: any): {
  earliestCheckIn: string;
  expectedStartTime: string;
  lateCutoffTime: string;
  expectedEndTime: string;
  earlyDepartureCutoffTime: string;
  latestCheckOut: string;
  absenceCutoffTime: string;
  workingDays: string[];
} {
  let expectedStartTime = settings?.staff_work_start_time || '08:00';
  let expectedEndTime = settings?.staff_work_end_time || '17:00';

  const [sH, sM] = expectedStartTime.split(':').map(Number);
  const [eH, eM] = expectedEndTime.split(':').map(Number);
  const startMins = (isNaN(sH) ? 8 : sH) * 60 + (isNaN(sM) ? 0 : sM);
  const endMins = (isNaN(eH) ? 17 : eH) * 60 + (isNaN(eM) ? 0 : eM);

  if (startMins >= endMins) {
    console.warn(`[StaffAttendance] Corrupted daily schedule detected: start ${expectedStartTime} >= end ${expectedEndTime}. Falling back to default 08:00 - 17:00.`);
    expectedStartTime = '08:00';
    expectedEndTime = '17:00';
  }

  const duration = Math.max(1, endMins - startMins);
  const rawLateGrace = settings?.staff_late_grace_minutes ?? 15;
  const lateGrace = Math.min(duration - 1, Math.max(0, Number(rawLateGrace) || 15));
  const lateCutoffTime = settings?.staff_checkin_late || addMinutesToTime(expectedStartTime, lateGrace);

  const rawEarlyTol = settings?.staff_early_checkout_tolerance_minutes ?? 15;
  const earlyTolerance = Math.min(duration - 1, Math.max(0, Number(rawEarlyTol) || 15));
  const earlyDepartureCutoffTime = settings?.staff_checkout_early || addMinutesToTime(expectedEndTime, -earlyTolerance);

  let earliestCheckIn = settings?.staff_earliest_checkin_time || settings?.staff_checkin_start || '06:00';
  if (isTimeAfter(earliestCheckIn, expectedStartTime)) {
    earliestCheckIn = addMinutesToTime(expectedStartTime, -60);
  }

  let latestCheckOut = settings?.staff_latest_checkout_time || '20:00';
  if (isTimeBefore(latestCheckOut, expectedEndTime)) {
    latestCheckOut = addMinutesToTime(expectedEndTime, 60);
  }

  const absenceCutoffMinutes = Math.min(duration, Math.max(1, Number(settings?.staff_absence_cutoff_minutes ?? 120) || 120));
  let absenceCutoffTime = settings?.staff_absence_cutoff_time || settings?.staffAbsenceCutoffTime || addMinutesToTime(expectedStartTime, absenceCutoffMinutes);
  if (isTimeBefore(absenceCutoffTime, expectedStartTime) || isTimeAfter(absenceCutoffTime, expectedEndTime)) {
    absenceCutoffTime = addMinutesToTime(expectedStartTime, Math.min(duration, Math.max(15, absenceCutoffMinutes)));
  }

  const configuredDaysStr = settings?.staff_working_days || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY';
  const workingDays = configuredDaysStr
    .split(',')
    .map((d: string) => d.trim().toUpperCase())
    .filter(Boolean);

  return {
    earliestCheckIn,
    expectedStartTime,
    lateCutoffTime,
    expectedEndTime,
    earlyDepartureCutoffTime,
    latestCheckOut,
    absenceCutoffTime,
    workingDays,
  };
}

/**
 * Interface representing a staff session configuration.
 */
export interface StaffSessionConfig {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateGraceMinutes?: number;
  earlyDepartureToleranceMinutes?: number;
  absenceCutoffMinutes?: number;
  earliestCheckInOffsetMinutes?: number;
  latestCheckOutOffsetMinutes?: number;
  allowCheckinAfterCutoff?: boolean;
  isActive?: boolean;
}

export const DEFAULT_STAFF_SESSIONS: StaffSessionConfig[] = [
  {
    id: 'morning',
    name: 'Morning Session',
    startTime: '08:00',
    endTime: '12:30',
    lateGraceMinutes: 15,
    earlyDepartureToleranceMinutes: 15,
    absenceCutoffMinutes: 60,
    earliestCheckInOffsetMinutes: 60,
    latestCheckOutOffsetMinutes: 60,
    allowCheckinAfterCutoff: false,
    isActive: true,
  },
  {
    id: 'afternoon',
    name: 'Afternoon Session',
    startTime: '13:30',
    endTime: '17:00',
    lateGraceMinutes: 15,
    earlyDepartureToleranceMinutes: 15,
    absenceCutoffMinutes: 60,
    earliestCheckInOffsetMinutes: 30,
    latestCheckOutOffsetMinutes: 60,
    allowCheckinAfterCutoff: false,
    isActive: true,
  },
];

export function getConfiguredSessions(settings?: any): StaffSessionConfig[] {
  if (!settings) return DEFAULT_STAFF_SESSIONS;
  const raw = (settings as any).staff_sessions;
  if (!raw) return DEFAULT_STAFF_SESSIONS;

  try {
    let parsed: any = raw;
    if (typeof raw === 'string') {
      parsed = JSON.parse(raw);
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s: any) => ({
        id: (s.id || s.name || 'session').toLowerCase().trim(),
        name: s.name || s.id || 'Session',
        startTime: s.startTime || s.start || '08:00',
        endTime: s.endTime || s.end || '12:30',
        lateGraceMinutes: Number(s.lateGraceMinutes ?? s.grace ?? 15),
        earlyDepartureToleranceMinutes: Number(s.earlyDepartureToleranceMinutes ?? 15),
        absenceCutoffMinutes: Number(s.absenceCutoffMinutes ?? 60),
        earliestCheckInOffsetMinutes: Number(s.earliestCheckInOffsetMinutes ?? 60),
        latestCheckOutOffsetMinutes: Number(s.latestCheckOutOffsetMinutes ?? 60),
        allowCheckinAfterCutoff: Boolean(s.allowCheckinAfterCutoff ?? false),
        isActive: s.isActive !== false,
      }));
    }
  } catch (err) {
    console.warn('[StaffAttendance] Failed to parse staff_sessions from settings, using default:', err);
  }
  return DEFAULT_STAFF_SESSIONS;
}

export function computeSessionThresholds(session: StaffSessionConfig) {
  const {
    startTime,
    endTime,
    lateGraceMinutes = 15,
    earlyDepartureToleranceMinutes = 15,
    absenceCutoffMinutes = 60,
    earliestCheckInOffsetMinutes = 60,
    latestCheckOutOffsetMinutes = 60,
  } = session;

  const lateCutoffTime = addMinutesToTime(startTime, lateGraceMinutes);
  const earlyDepartureCutoffTime = addMinutesToTime(endTime, -earlyDepartureToleranceMinutes);
  const earliestCheckIn = addMinutesToTime(startTime, -earliestCheckInOffsetMinutes);
  const latestCheckOut = addMinutesToTime(endTime, latestCheckOutOffsetMinutes);
  const absenceCutoffTime = addMinutesToTime(startTime, absenceCutoffMinutes);

  return {
    expectedStartTime: startTime,
    expectedEndTime: endTime,
    lateCutoffTime,
    earlyDepartureCutoffTime,
    earliestCheckIn,
    latestCheckOut,
    absenceCutoffTime,
  };
}

export function findSession(sessions: StaffSessionConfig[], sessionIdOrName: string): StaffSessionConfig | undefined {
  if (!sessionIdOrName) return undefined;
  const key = sessionIdOrName.toLowerCase().trim();
  return sessions.find(s => s.id.toLowerCase() === key || s.name.toLowerCase() === key);
}

export function normaliseSessionKey(raw?: string | null): string {
  if (!raw || raw.trim() === '') return 'daily';
  return raw.toLowerCase().trim();
}

/**
 * Check-in for a staff member (self or admin-assisted)
 */
export async function checkIn(userId: string, _schoolId?: string, data: {
  date?: string;
  session?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
} = {}) {
  const user = await prisma.user.findFirst({
    where: { id: userId, is_active: true }
  });
  if (!user) {
    throw new Error('Staff member not found or inactive');
  }

  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';

  let locVerified = false;
  let locDistance: number | null = null;
  if (settings?.staff_geo_required !== false) {
    const geoResult = validateGeofence(data, settings);
    locVerified = geoResult.locVerified;
    locDistance = geoResult.locDistance;
  } else {
    locVerified = data.locationVerified ?? true;
    locDistance = data.locationDistance ?? null;
  }

  const isFaceRequired = settings?.staff_face_required ?? true;
  if (isFaceRequired && !data.faceVerified) {
    throw new Error('Face verification failed or is required for staff check-in.');
  }

  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);
  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  let sessionKey: string;
  let expectedEndTime: string;
  let lateCutoffTime: string;
  let earliestCheckIn: string;
  let absenceCutoffTime: string;
  let allowCheckinAfterCutoff = false;

  if (attendanceMode === 'session_based') {
    if (!data.session) throw new Error('Session is required when staff attendance mode is session-based.');
    const sessions = getConfiguredSessions(settings);
    const sess = findSession(sessions, data.session);
    if (!sess) throw new Error(`Session "${data.session}" is not configured or is inactive.`);
    sessionKey = sess.id.toLowerCase();
    const thresholds = computeSessionThresholds(sess);
    expectedEndTime = thresholds.expectedEndTime || sess.endTime;
    lateCutoffTime = thresholds.lateCutoffTime;
    earliestCheckIn = thresholds.earliestCheckIn;
    absenceCutoffTime = thresholds.absenceCutoffTime;
    allowCheckinAfterCutoff = sess.allowCheckinAfterCutoff ?? (settings as any)?.allow_staff_checkin_after_cutoff ?? false;
  } else {
    sessionKey = 'daily';
    const schedule = computeWorkingScheduleThresholds(settings);
    expectedEndTime = schedule.expectedEndTime;
    lateCutoffTime = schedule.lateCutoffTime;
    earliestCheckIn = schedule.earliestCheckIn;
    absenceCutoffTime = schedule.absenceCutoffTime;
    allowCheckinAfterCutoff = (settings as any)?.allow_staff_checkin_after_cutoff ?? false;
  }

  if (earliestCheckIn && isTimeBefore(currentTimeHHMM, earliestCheckIn)) {
    throw new Error(`Check-in is not open yet. Earliest allowed check-in is ${formatCivilTime(earliestCheckIn)}.`);
  }

  if (expectedEndTime && (isTimeAfter(currentTimeHHMM, expectedEndTime) || currentTimeHHMM === expectedEndTime)) {
    throw new Error(`Check-in closed for today. The checkout time (${formatCivilTime(expectedEndTime)}) has passed.`);
  }

  if (!allowCheckinAfterCutoff && absenceCutoffTime && isTimeAfter(currentTimeHHMM, absenceCutoffTime)) {
    throw new Error(`Check-in closed for today. The absence cutoff time (${formatCivilTime(absenceCutoffTime)}) has passed.`);
  }

  let status = 'PRESENT';
  let remarks = data.remarks || null;

  if (workingDayInfo.isWorkingDay) {
    if (isTimeAfter(currentTimeHHMM, lateCutoffTime)) {
      status = 'LATE';
    }
  } else {
    status = 'PRESENT';
    const nonWorkNote = workingDayInfo.isHoliday
      ? `Holiday Attendance (${workingDayInfo.holidayName})`
      : `Weekend/Non-Working Day Attendance (${workingDayInfo.dayOfWeek})`;
    remarks = remarks ? `${remarks} | ${nonWorkNote}` : nonWorkNote;
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      session: sessionKey,
    }
  });

  if (existing && existing.checkInTime) {
    const sessLabel = attendanceMode === 'session_based' ? ` (${sessionKey} session)` : '';
    throw new Error(`Staff is already checked in for ${dateStr}${sessLabel} at ${existing.checkInTime.toISOString()}`);
  }

  if (existing) {
    return await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        status,
        checkInTime: now,
        checkInLatitude: data.latitude ?? null,
        checkInLongitude: data.longitude ?? null,
        geofenceVerified: locVerified,
        geofenceDistance: locDistance,
        faceVerified: data.faceVerified ?? false,
        faceConfidence: data.faceConfidence ?? null,
        remarks: remarks ?? existing.remarks,
      }
    });
  }

  return await prisma.staffAttendance.create({
    data: {
      userId,
      date: startDate,
      session: sessionKey,
      status,
      checkInTime: now,
      checkInLatitude: data.latitude ?? null,
      checkInLongitude: data.longitude ?? null,
      geofenceVerified: locVerified,
      geofenceDistance: locDistance,
      faceVerified: data.faceVerified ?? false,
      faceConfidence: data.faceConfidence ?? null,
      remarks: remarks ?? null,
    }
  });
}

/**
 * Check-out for a staff member. Supports daily and session-based modes.
 */
export async function checkOut(userId: string, _schoolId?: string, data: {
  date?: string;
  session?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
} = {}) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';

  let locVerified = false;
  let locDistance: number | null = null;
  if (settings?.staff_geo_required !== false) {
    const geoResult = validateGeofence(data, settings);
    locVerified = geoResult.locVerified;
    locDistance = geoResult.locDistance;
  } else {
    locVerified = data.locationVerified ?? true;
    locDistance = data.locationDistance ?? null;
  }

  const isFaceRequired = settings?.staff_face_required ?? true;
  if (isFaceRequired && !data.faceVerified) {
    throw new Error('Face verification failed or is required for staff check-out.');
  }

  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);
  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  let sessionKey: string;
  let earlyDepartureCutoffTime: string;

  if (attendanceMode === 'session_based') {
    if (!data.session) throw new Error('Session is required when staff attendance mode is session-based.');
    const sessions = getConfiguredSessions(settings);
    const sess = findSession(sessions, data.session);
    if (!sess) throw new Error(`Session "${data.session}" is not configured or is inactive.`);
    sessionKey = sess.id.toLowerCase();
    earlyDepartureCutoffTime = computeSessionThresholds(sess).earlyDepartureCutoffTime;
  } else {
    sessionKey = 'daily';
    earlyDepartureCutoffTime = computeWorkingScheduleThresholds(settings).earlyDepartureCutoffTime;
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      session: sessionKey,
    }
  });

  if (!existing || !existing.checkInTime) {
    const sessLabel = attendanceMode === 'session_based' ? ` (${sessionKey} session)` : '';
    throw new Error(`Cannot check out without checking in first on ${dateStr}${sessLabel}`);
  }

  if (existing.checkOutTime) {
    const sessLabel = attendanceMode === 'session_based' ? ` (${sessionKey} session)` : '';
    throw new Error(`Staff is already checked out for ${dateStr}${sessLabel} at ${existing.checkOutTime.toISOString()}`);
  }

  let status = existing.status;
  if (workingDayInfo.isWorkingDay) {
    if (isTimeBefore(currentTimeHHMM, earlyDepartureCutoffTime)) {
      if (status === 'PRESENT' || status === 'LATE') {
        status = 'EARLY_DEPARTURE';
      }
    }
  }

  return await prisma.staffAttendance.update({
    where: { id: existing.id },
    data: {
      status,
      checkOutTime: now,
      checkOutLatitude: data.latitude ?? null,
      checkOutLongitude: data.longitude ?? null,
      remarks: data.remarks ? `${existing.remarks ? existing.remarks + ' | ' : ''}${data.remarks}` : existing.remarks,
    }
  });
}

/**
 * Face enrollment for a staff member (admin only)
 */
export async function enrollFace(adminUserId: string, targetUserId: string, _schoolId?: string, descriptor?: number[]) {
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
    throw new Error('Valid face descriptor array is required for enrollment');
  }

  const staff = await prisma.user.findFirst({
    where: { id: targetUserId }
  });
  if (!staff) {
    throw new Error('Staff member not found');
  }

  const existing = await prisma.staffFaceEnrollment.findUnique({
    where: { userId: targetUserId }
  });

  if (existing) {
    return await prisma.staffFaceEnrollment.update({
      where: { userId: targetUserId },
      data: {
        descriptor,
        enrolledBy: adminUserId,
        updatedAt: new Date()
      }
    });
  }

  return await prisma.staffFaceEnrollment.create({
    data: {
      userId: targetUserId,
      descriptor,
      enrolledBy: adminUserId,
    }
  });
}

/**
 * Retrieve face descriptor for client-side matching
 */
export async function getEnrolledDescriptor(userId: string, _schoolId?: string) {
  return await prisma.staffFaceEnrollment.findFirst({
    where: { userId }
  });
}

/**
 * Get staff attendance list (admin view)
 */
export async function getStaffAttendance(_schoolId?: string, filters: {
  date?: string;
  startDate?: string;
  endDate?: string;
  role?: string;
  userId?: string;
  status?: string;
  session?: string;
  mode?: string;
  search?: string;
  geofenceVerified?: string | boolean;
  faceVerified?: string | boolean;
} = {}) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = filters.mode || (settings as any)?.staff_attendance_mode || 'daily';

  if (filters.date) {
    try {
      await processAutomaticStaffAbsences({
        date: filters.date,
        session: filters.session,
      });
    } catch (autoErr) {
      console.warn('[StaffAttendance] Auto absence check failed during getStaffAttendance:', autoErr);
    }
  }

  const where: any = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status.toUpperCase();
  }

  if (filters.date) {
    const { startDate, endDate } = normalizeStaffDate(filters.date);
    where.date = { gte: startDate, lte: endDate };
  } else if (filters.startDate && filters.endDate) {
    const { startDate } = normalizeStaffDate(filters.startDate);
    const { endDate } = normalizeStaffDate(filters.endDate);
    where.date = { gte: startDate, lte: endDate };
  }

  const userConditions: any = {};
  if (filters.role && filters.role !== 'all') {
    userConditions.role = filters.role;
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    userConditions.OR = [
      { full_name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } }
    ];
  }

  if (Object.keys(userConditions).length > 0) {
    where.user = userConditions;
  }

  if (filters.geofenceVerified !== undefined && filters.geofenceVerified !== '') {
    where.geofenceVerified = filters.geofenceVerified === true || filters.geofenceVerified === 'true';
  }

  if (filters.faceVerified !== undefined && filters.faceVerified !== '') {
    where.faceVerified = filters.faceVerified === true || filters.faceVerified === 'true';
  }

  if (attendanceMode === 'daily') {
    where.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    if (filters.session && filters.session !== 'all' && filters.session !== 'ALL') {
      where.session = normaliseSessionKey(filters.session);
    } else {
      where.AND = [
        { session: { not: null } },
        { session: { not: '' } },
        { session: { not: 'daily' } }
      ];
    }
  }

  return await prisma.staffAttendance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          phone: true,
          profile_photo: true,
          faceEnrollment: {
            select: { id: true, enrolledAt: true }
          }
        }
      }
    },
    orderBy: [{ date: 'desc' }, { session: 'asc' }]
  });
}

/**
 * Get comprehensive daily or range summary stats for staff attendance.
 */
export async function getStaffAttendanceStats(_schoolId?: string, date?: string, session?: string) {
  const { dateStr, startDate, endDate } = normalizeStaffDate(date);

  try {
    await processAutomaticStaffAbsences({
      date: dateStr,
      session,
    });
  } catch (autoErr) {
    console.warn('[StaffAttendance] Auto absence check failed during getStaffAttendanceStats:', autoErr);
  }

  const settings = await prisma.schoolSettings.findFirst();
  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';

  const totalStaffCount = await prisma.user.count({
    where: {
      is_active: true,
      role: { notIn: ['parent', 'student'] }
    }
  });

  const recordWhere: any = { date: { gte: startDate, lte: endDate } };
  
  if (attendanceMode === 'daily') {
    recordWhere.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    if (session && session !== 'all' && session !== 'ALL') {
      recordWhere.session = normaliseSessionKey(session);
    } else {
      recordWhere.AND = [
        { session: { not: null } },
        { session: { not: '' } },
        { session: { not: 'daily' } }
      ];
    }
  }

  const records = await prisma.staffAttendance.findMany({
    where: recordWhere,
    include: {
      user: {
        select: { id: true, full_name: true, role: true, profile_photo: true }
      }
    }
  });

  let present = 0;
  let late = 0;
  let absent = 0;
  let earlyDeparture = 0;
  let onLeave = 0;
  let permission = 0;
  let faceVerifiedCount = 0;
  let geoVerifiedCount = 0;
  let checkedInCount = 0;

  for (const r of records) {
    if (r.status === 'PRESENT') present++;
    else if (r.status === 'LATE') late++;
    else if (r.status === 'ABSENT') absent++;
    else if (r.status === 'EARLY_DEPARTURE') earlyDeparture++;
    else if (r.status === 'LEAVE') onLeave++;
    else if (r.status === 'PERMISSION') permission++;

    if (r.checkInTime) checkedInCount++;
    if (r.faceVerified) faceVerifiedCount++;
    if (r.geofenceVerified) geoVerifiedCount++;
  }

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const isToday = dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });

  const scheduleThresholds = computeWorkingScheduleThresholds(settings);
  let activeAbsenceCutoff = scheduleThresholds.absenceCutoffTime;
  let activeStartTime = scheduleThresholds.expectedStartTime;

  if (attendanceMode === 'session_based') {
    const sessions = getConfiguredSessions(settings);
    const targetSession = session && session !== 'all' ? findSession(sessions, session) : sessions[0];
    if (targetSession) {
      const sessThresholds = computeSessionThresholds(targetSession);
      activeAbsenceCutoff = sessThresholds.absenceCutoffTime;
      activeStartTime = sessThresholds.expectedStartTime;
    }
  }

  const uniqueStaffIds = new Set(records.map((r: any) => r.userId));
  const notCheckedIn = Math.max(0, totalStaffCount - uniqueStaffIds.size);

  let notStarted = 0;
  let pendingCheckIn = 0;

  if (workingDayInfo.isWorkingDay) {
    if (isToday) {
      if (isTimeBefore(currentTimeHHMM, activeStartTime)) {
        notStarted = notCheckedIn;
      } else if (isTimeBefore(currentTimeHHMM, activeAbsenceCutoff)) {
        pendingCheckIn = notCheckedIn;
      }
    }
  }

  let sessionBreakdown: Record<string, any> | undefined;
  if (attendanceMode === 'session_based') {
    const bySession: Record<string, any> = {};
    for (const r of records) {
      const sk = (r as any).session || 'unknown';
      if (!bySession[sk]) {
        bySession[sk] = { session: sk, present: 0, late: 0, absent: 0, earlyDeparture: 0, onLeave: 0, checkedIn: 0, total: 0 };
      }
      bySession[sk].total++;
      if ((r as any).checkInTime) bySession[sk].checkedIn++;
      if (r.status === 'PRESENT') bySession[sk].present++;
      else if (r.status === 'LATE') bySession[sk].late++;
      else if (r.status === 'ABSENT') bySession[sk].absent++;
      else if (r.status === 'EARLY_DEPARTURE') bySession[sk].earlyDeparture++;
      else if (r.status === 'LEAVE' || r.status === 'PERMISSION') bySession[sk].onLeave++;
    }
    sessionBreakdown = bySession;
  }

  return {
    date: dateStr,
    attendanceMode,
    isWorkingDay: workingDayInfo.isWorkingDay,
    isHoliday: workingDayInfo.isHoliday,
    isWeekend: workingDayInfo.isWeekend,
    holidayName: workingDayInfo.holidayName,
    dayOfWeek: workingDayInfo.dayOfWeek,
    calendarNote: workingDayInfo.reason,
    totalStaff: totalStaffCount,
    present,
    late,
    absent,
    earlyDeparture,
    onLeave: onLeave + permission,
    leaveCount: onLeave,
    permissionCount: permission,
    checkedIn: checkedInCount,
    notCheckedIn,
    notStarted,
    pendingCheckIn,
    absenceCutoffTime: activeAbsenceCutoff,
    expectedStartTime: activeStartTime,
    isCutoffPassed: !isToday || isTimeAfter(currentTimeHHMM, activeAbsenceCutoff),
    faceVerifiedCount,
    geoVerifiedCount,
    attendanceRate: totalStaffCount > 0 ? Math.round(((present + late + earlyDeparture) / totalStaffCount) * 100) : 0,
    sessionBreakdown,
  };
}

/**
 * Get current staff user's own attendance history
 */
export async function getMyAttendance(userId: string, _schoolId?: string, filters: {
  startDate?: string;
  endDate?: string;
  date?: string;
  session?: string;
  mode?: string;
} = {}) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = filters.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const where: any = { userId };

  if (filters.date) {
    const { startDate, endDate } = normalizeStaffDate(filters.date);
    where.date = { gte: startDate, lte: endDate };
  } else if (filters.startDate && filters.endDate) {
    const { startDate } = normalizeStaffDate(filters.startDate);
    const { endDate } = normalizeStaffDate(filters.endDate);
    where.date = { gte: startDate, lte: endDate };
  }

  if (attendanceMode === 'daily') {
    where.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    if (filters.session && filters.session !== 'all' && filters.session !== 'ALL') {
      where.session = normaliseSessionKey(filters.session);
    } else {
      where.AND = [
        { session: { not: null } },
        { session: { not: '' } },
        { session: { not: 'daily' } }
      ];
    }
  }

  return await prisma.staffAttendance.findMany({
    where,
    orderBy: [{ date: 'desc' }, { session: 'asc' }]
  });
}

/**
 * Bulk sync staff check-in/out records from offline IndexedDB queue
 */
export async function bulkSyncStaffAttendance(records: Array<{
  userId: string;
  type: 'checkin' | 'checkout';
  date: string;
  session?: string;
  timestamp?: number;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
}>, _schoolId?: string) {
  const results: any[] = [];
  const errors: string[] = [];

  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';
  const schedule = computeWorkingScheduleThresholds(settings);

  for (const item of records) {
    try {
      const { dateStr, startDate, endDate } = normalizeStaffDate(item.date);
      const recordTime = item.timestamp ? new Date(item.timestamp) : new Date();
      const timeHHMM = recordTime.toLocaleTimeString('en-US', {
        timeZone: 'Africa/Addis_Ababa',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      const sessionKey = attendanceMode === 'session_based'
        ? (normaliseSessionKey(item.session) || 'morning')
        : 'daily';

      const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);

      const existing = await prisma.staffAttendance.findFirst({
        where: {
          userId: item.userId,
          date: { gte: startDate, lte: endDate },
          session: sessionKey,
        }
      });

      if (item.type === 'checkin') {
        let status = 'PRESENT';
        let remarks = item.remarks || null;

        if (workingDayInfo.isWorkingDay) {
          if (isTimeAfter(timeHHMM, schedule.lateCutoffTime)) {
            status = 'LATE';
          }
        } else {
          const nonWorkNote = workingDayInfo.isHoliday
            ? `Holiday Attendance (${workingDayInfo.holidayName})`
            : `Weekend/Non-Working Day Attendance (${workingDayInfo.dayOfWeek})`;
          remarks = remarks ? `${remarks} | ${nonWorkNote}` : nonWorkNote;
        }

        if (existing) {
          if (!existing.checkInTime) {
            const updated = await prisma.staffAttendance.update({
              where: { id: existing.id },
              data: {
                status,
                checkInTime: recordTime,
                checkInLatitude: item.latitude ?? existing.checkInLatitude,
                checkInLongitude: item.longitude ?? existing.checkInLongitude,
                geofenceVerified: item.locationVerified ?? existing.geofenceVerified,
                geofenceDistance: item.locationDistance ?? existing.geofenceDistance,
                faceVerified: item.faceVerified ?? existing.faceVerified,
                faceConfidence: item.faceConfidence ?? existing.faceConfidence,
                remarks: remarks ?? existing.remarks,
              }
            });
            results.push(updated);
          } else {
            results.push(existing);
          }
        } else {
          const created = await prisma.staffAttendance.create({
            data: {
              userId: item.userId,
              date: startDate,
              session: sessionKey,
              status,
              checkInTime: recordTime,
              checkInLatitude: item.latitude ?? null,
              checkInLongitude: item.longitude ?? null,
              geofenceVerified: item.locationVerified ?? false,
              geofenceDistance: item.locationDistance ?? null,
              faceVerified: item.faceVerified ?? false,
              faceConfidence: item.faceConfidence ?? null,
              remarks: remarks ?? null,
            }
          });
          results.push(created);
        }
      } else if (item.type === 'checkout') {
        if (existing) {
          let status = existing.status;
          if (workingDayInfo.isWorkingDay) {
            if (isTimeBefore(timeHHMM, schedule.earlyDepartureCutoffTime)) {
              if (status === 'PRESENT') status = 'EARLY_DEPARTURE';
            }
          }

          if (!existing.checkOutTime) {
            const updated = await prisma.staffAttendance.update({
              where: { id: existing.id },
              data: {
                status,
                checkOutTime: recordTime,
                checkOutLatitude: item.latitude ?? existing.checkOutLatitude,
                checkOutLongitude: item.longitude ?? existing.checkOutLongitude,
                remarks: item.remarks ? `${existing.remarks ? existing.remarks + ' | ' : ''}${item.remarks}` : existing.remarks,
              }
            });
            results.push(updated);
          } else {
            results.push(existing);
          }
        }
      }
    } catch (err: any) {
      errors.push(`Record ${item.userId} ${item.type} error: ${err.message}`);
    }
  }

  return { syncedCount: results.length, total: records.length, errors, results };
}

/**
 * Admin manual marking of absent staff for a given date.
 */
export async function markAbsentStaff(
  adminUserId: string,
  _schoolId: string | undefined,
  userIds: string[],
  date: string,
  remarks?: string,
  session?: string
) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';
  const { startDate, endDate } = normalizeStaffDate(date);
  const sessionKey = attendanceMode === 'session_based' ? normaliseSessionKey(session) : 'daily';
  const results: any[] = [];

  for (const userId of userIds) {
    const existing = await prisma.staffAttendance.findFirst({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        session: sessionKey,
      }
    });

    if (existing) {
      const updated = await prisma.staffAttendance.update({
        where: { id: existing.id },
        data: {
          status: 'ABSENT',
          markedAbsentBy: adminUserId,
          remarks: remarks ?? existing.remarks,
        }
      });
      results.push(updated);
    } else {
      const created = await prisma.staffAttendance.create({
        data: {
          userId,
          date: startDate,
          session: sessionKey,
          status: 'ABSENT',
          markedAbsentBy: adminUserId,
          remarks: remarks ?? null,
        }
      });
      results.push(created);
    }
  }

  return results;
}

/**
 * Admin manual attendance correction with full auditing
 */
export async function correctAttendance(
  adminUserId: string,
  recordId: string,
  _schoolId: string | undefined,
  corrections: {
    status?: string;
    checkInTime?: string | Date | null;
    checkOutTime?: string | Date | null;
    remarks?: string;
    reason: string;
  }
) {
  if (!corrections.reason || !corrections.reason.trim()) {
    throw new Error('A mandatory correction reason is required for administrative audit trail.');
  }

  const existing = await prisma.staffAttendance.findUnique({
    where: { id: recordId },
    include: { user: true }
  });

  if (!existing) {
    throw new Error('Staff attendance record not found');
  }

  const updateData: any = {
    correctedBy: adminUserId,
    correctedAt: new Date(),
    previousStatus: existing.status,
    previousCheckIn: existing.checkInTime,
    correctionReason: corrections.reason.trim(),
  };

  if (corrections.status) {
    updateData.status = corrections.status.toUpperCase();
  }

  if (corrections.checkInTime !== undefined) {
    updateData.checkInTime = corrections.checkInTime ? new Date(corrections.checkInTime) : null;
  }

  if (corrections.checkOutTime !== undefined) {
    updateData.checkOutTime = corrections.checkOutTime ? new Date(corrections.checkOutTime) : null;
  }

  if (corrections.remarks !== undefined) {
    updateData.remarks = corrections.remarks;
  }

  return await prisma.staffAttendance.update({
    where: { id: recordId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          phone: true,
          profile_photo: true
        }
      }
    }
  });
}

/**
 * Set Leave or Permission for a staff member.
 */
export async function setLeaveOrPermission(
  adminUserId: string,
  userId: string,
  _schoolId: string | undefined,
  data: {
    date: string;
    status: 'LEAVE' | 'PERMISSION';
    reason: string;
    session?: string;
    mode?: string;
  }
) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = data.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const { startDate, endDate } = normalizeStaffDate(data.date);

  let sessionKey: string;
  if (attendanceMode === 'session_based') {
    sessionKey = normaliseSessionKey(data.session) || 'morning';
  } else {
    sessionKey = 'daily';
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      session: sessionKey,
    }
  });

  if (existing) {
    return await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        remarks: data.reason,
        correctedBy: adminUserId,
        correctedAt: new Date(),
        previousStatus: existing.status,
        correctionReason: `Marked as ${data.status}: ${data.reason}`,
      }
    });
  }

  return await prisma.staffAttendance.create({
    data: {
      userId,
      date: startDate,
      session: sessionKey,
      status: data.status,
      remarks: data.reason,
      markedAbsentBy: adminUserId,
    }
  });
}

/**
 * Generate attendance report aggregated across a date range.
 */
export async function getStaffAttendanceReport(
  _schoolId: string | undefined,
  filters: {
    startDate: string;
    endDate: string;
    role?: string;
    userId?: string;
    mode?: string;
    session?: string;
  }
) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = filters.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const { startDate } = normalizeStaffDate(filters.startDate);
  const { endDate } = normalizeStaffDate(filters.endDate);

  const where: any = {
    date: { gte: startDate, lte: endDate }
  };

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.role && filters.role !== 'all') {
    where.user = { role: filters.role };
  }

  if (attendanceMode === 'daily') {
    where.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    if (filters.session && filters.session !== 'all' && filters.session !== 'ALL') {
      where.session = normaliseSessionKey(filters.session);
    } else {
      where.AND = [
        { session: { not: null } },
        { session: { not: '' } },
        { session: { not: 'daily' } },
      ];
    }
  }

  const records = await prisma.staffAttendance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          profile_photo: true
        }
      }
    },
    orderBy: { date: 'asc' }
  });

  const staffMap = new Map<string, any>();

  for (const r of records) {
    if (!staffMap.has(r.userId)) {
      staffMap.set(r.userId, {
        user: r.user,
        totalRecords: 0,
        present: 0,
        late: 0,
        absent: 0,
        earlyDeparture: 0,
        onLeave: 0,
        geoVerified: 0,
        faceVerified: 0,
        records: []
      });
    }

    const item = staffMap.get(r.userId);
    item.totalRecords++;
    if (r.status === 'PRESENT') item.present++;
    else if (r.status === 'LATE') item.late++;
    else if (r.status === 'ABSENT') item.absent++;
    else if (r.status === 'EARLY_DEPARTURE') item.earlyDeparture++;
    else if (r.status === 'LEAVE' || r.status === 'PERMISSION') item.onLeave++;

    if (r.geofenceVerified) item.geoVerified++;
    if (r.faceVerified) item.faceVerified++;
    item.records.push(r);
  }

  const dayMap = new Map<string, { date: string; present: number; late: number; absent: number; earlyDeparture: number; onLeave: number; total: number }>();
  for (const r of records) {
    const dStr = r.date.toISOString().split('T')[0];
    if (!dayMap.has(dStr)) {
      dayMap.set(dStr, { date: dStr, present: 0, late: 0, absent: 0, earlyDeparture: 0, onLeave: 0, total: 0 });
    }
    const d = dayMap.get(dStr)!;
    d.total++;
    if (r.status === 'PRESENT') d.present++;
    else if (r.status === 'LATE') d.late++;
    else if (r.status === 'ABSENT') d.absent++;
    else if (r.status === 'EARLY_DEPARTURE') d.earlyDeparture++;
    else if (r.status === 'LEAVE' || r.status === 'PERMISSION') d.onLeave++;
  }

  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    attendanceMode,
    totalRecords: records.length,
    staffSummary: Array.from(staffMap.values()),
    dailyBreakdown: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

/**
 * Automatically evaluates and marks unrecorded staff as ABSENT after the configured absence cutoff time.
 */
export async function processAutomaticStaffAbsences(options?: {
  schoolId?: string;
  date?: string;
  session?: string;
  force?: boolean;
}) {
  const { dateStr, startDate, endDate } = normalizeStaffDate(options?.date);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const isToday = dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });

  const summary = {
    date: dateStr,
    currentTime: currentTimeHHMM,
    schoolsEvaluated: 1,
    totalEligibleStaff: 0,
    alreadyRecorded: 0,
    markedAbsent: 0,
    skippedNonWorking: 0,
    skippedBeforeCutoff: 0,
    details: [] as any[],
  };

  const settings = await prisma.schoolSettings.findFirst();
  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);

  if (!workingDayInfo.isWorkingDay) {
    summary.skippedNonWorking++;
    summary.details.push({
      status: 'SKIPPED_NON_WORKING_DAY',
      reason: workingDayInfo.reason || (workingDayInfo.isHoliday ? `Holiday: ${workingDayInfo.holidayName}` : 'Non-working day')
    });
    return summary;
  }

  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';
  const eligibleStaff = await prisma.user.findMany({
    where: {
      is_active: true,
      role: { notIn: ['parent', 'student'] }
    },
    select: { id: true, full_name: true, role: true, email: true }
  });

  summary.totalEligibleStaff += eligibleStaff.length;
  if (eligibleStaff.length === 0) return summary;

  let sessionsToProcess: Array<{ id: string; name: string; absenceCutoffTime: string; expectedStartTime: string }>;
  if (attendanceMode === 'session_based') {
    const allSessions = getConfiguredSessions(settings);
    const filtered = options?.session && options.session !== 'all' && options.session !== 'ALL'
      ? allSessions.filter(s => s.id.toLowerCase() === options.session!.toLowerCase())
      : allSessions;

    sessionsToProcess = filtered.map(s => {
      const thresholds = computeSessionThresholds(s);
      return {
        id: s.id.toLowerCase(),
        name: s.name,
        absenceCutoffTime: thresholds.absenceCutoffTime,
        expectedStartTime: thresholds.expectedStartTime,
      };
    });
  } else {
    const schedule = computeWorkingScheduleThresholds(settings);
    sessionsToProcess = [{
      id: 'daily',
      name: 'Daily',
      absenceCutoffTime: schedule.absenceCutoffTime,
      expectedStartTime: schedule.expectedStartTime,
    }];
  }

  for (const sessionConfig of sessionsToProcess) {
    const cutoffPassed = !isToday || isTimeAfter(currentTimeHHMM, sessionConfig.absenceCutoffTime) || currentTimeHHMM === sessionConfig.absenceCutoffTime;

    if (!cutoffPassed && !options?.force) {
      summary.skippedBeforeCutoff++;
      summary.details.push({
        session: sessionConfig.id,
        status: 'PENDING_CUTOFF',
        currentTime: currentTimeHHMM,
        absenceCutoffTime: sessionConfig.absenceCutoffTime,
        message: `Absence cutoff ${sessionConfig.absenceCutoffTime} has not elapsed yet.`
      });
      continue;
    }

    const existingRecords = await prisma.staffAttendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        session: sessionConfig.id,
      }
    });

    const existingRecordMap = new Map<string, any>();
    for (const rec of existingRecords) {
      existingRecordMap.set(rec.userId, rec);
    }

    let schoolSessionMarked = 0;

    for (const staff of eligibleStaff) {
      const existing = existingRecordMap.get(staff.id);

      if (existing) {
        if (existing.checkInTime || existing.status === 'LEAVE' || existing.status === 'PERMISSION' || existing.status === 'PRESENT' || existing.status === 'LATE' || existing.status === 'EARLY_DEPARTURE') {
          summary.alreadyRecorded++;
          continue;
        }
        if (existing.status === 'ABSENT') {
          summary.alreadyRecorded++;
          continue;
        }

        await prisma.staffAttendance.update({
          where: { id: existing.id },
          data: {
            status: 'ABSENT',
            markedAbsentBy: 'SYSTEM_AUTO_CUTOFF',
            remarks: existing.remarks ? `${existing.remarks} | Auto-marked absent after cutoff (${sessionConfig.absenceCutoffTime})` : `Auto-marked absent after cutoff (${sessionConfig.absenceCutoffTime})`
          }
        });
        schoolSessionMarked++;
        summary.markedAbsent++;
      } else {
        await prisma.staffAttendance.create({
          data: {
            userId: staff.id,
            date: startDate,
            session: sessionConfig.id,
            status: 'ABSENT',
            markedAbsentBy: 'SYSTEM_AUTO_CUTOFF',
            remarks: `Auto-marked absent after cutoff (${sessionConfig.absenceCutoffTime})`
          }
        });
        schoolSessionMarked++;
        summary.markedAbsent++;
      }
    }

    summary.details.push({
      session: sessionConfig.id,
      markedAbsent: schoolSessionMarked,
      absenceCutoffTime: sessionConfig.absenceCutoffTime,
    });
  }

  return summary;
}
