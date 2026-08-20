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

  // Runtime safety: ensure startTime < endTime
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

  // Absence cutoff: configured time, or start time + cutoff minutes (clamped within [start, end])
  const absenceCutoffMinutes = Math.min(duration, Math.max(1, Number(settings?.staff_absence_cutoff_minutes ?? 120) || 120));
  let absenceCutoffTime = settings?.staff_absence_cutoff_time || settings?.staffAbsenceCutoffTime || addMinutesToTime(expectedStartTime, absenceCutoffMinutes);
  if (isTimeBefore(absenceCutoffTime, expectedStartTime) || isTimeAfter(absenceCutoffTime, expectedEndTime)) {
    absenceCutoffTime = addMinutesToTime(expectedStartTime, Math.min(duration, Math.max(15, absenceCutoffMinutes)));
  }

  const workingDaysStr = settings?.staff_working_days || 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY';
  const workingDays = workingDaysStr.split(',').map((d: string) => d.trim().toUpperCase()).filter(Boolean);

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

// ─── Session Helpers ──────────────────────────────────────────────────────────

export interface StaffSession {
  id: string;
  name: string;
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  lateGraceMinutes: number;
  earlyDepartureToleranceMinutes: number;
  absenceCutoffMinutes?: number;
  absenceCutoffTime?: string;
  earliestCheckinTime?: string;
  latestCheckoutTime?: string;
  allowCheckinAfterCutoff?: boolean;
  isActive: boolean;
}

const DEFAULT_STAFF_SESSIONS: StaffSession[] = [
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
    isActive: true,
  },
];

/**
 * Parse sessions from settings JSON or return fixed morning/afternoon defaults.
 */
export function getConfiguredSessions(settings?: any): StaffSession[] {
  try {
    const raw = settings?.staff_sessions;
    if (raw) {
      const parsed: StaffSession[] = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Enforce that only Morning and Afternoon exist
        const morning = parsed.find(s => s && (s.id === 'morning' || s.name?.toLowerCase() === 'morning')) || DEFAULT_STAFF_SESSIONS[0];
        const afternoon = parsed.find(s => s && (s.id === 'afternoon' || s.name?.toLowerCase() === 'afternoon')) || DEFAULT_STAFF_SESSIONS[1];
        return [
          { ...DEFAULT_STAFF_SESSIONS[0], ...morning, id: 'morning', name: 'Morning' },
          { ...DEFAULT_STAFF_SESSIONS[1], ...afternoon, id: 'afternoon', name: 'Afternoon' },
        ];
      }
    }
  } catch (_) {}
  return DEFAULT_STAFF_SESSIONS;
}

/**
 * Find the session config by id/name (case-insensitive).
 */
export function findSession(sessions: StaffSession[], sessionId: string): StaffSession | undefined {
  const key = sessionId.toLowerCase().trim();
  return sessions.find((s) => s.id.toLowerCase() === key || s.name.toLowerCase() === key);
}

/**
 * Compute schedule thresholds for a specific session with runtime validation and safety bounds.
 */
export function computeSessionThresholds(session: StaffSession): {
  expectedStartTime: string;
  lateCutoffTime: string;
  expectedEndTime: string;
  earlyDepartureCutoffTime: string;
  absenceCutoffTime: string;
  earliestCheckIn: string;
  latestCheckOut: string;
} {
  let startTime = session.startTime || (session.id === 'afternoon' ? '13:30' : '08:00');
  let endTime = session.endTime || (session.id === 'afternoon' ? '17:00' : '12:30');

  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startMins = (isNaN(sH) ? 8 : sH) * 60 + (isNaN(sM) ? 0 : sM);
  const endMins = (isNaN(eH) ? 12 : eH) * 60 + (isNaN(eM) ? 30 : eM);

  if (startMins >= endMins) {
    console.warn(`[StaffAttendance] Corrupted session ${session.id} detected: start ${startTime} >= end ${endTime}. Falling back to default.`);
    const fallback = session.id === 'afternoon' ? DEFAULT_STAFF_SESSIONS[1] : DEFAULT_STAFF_SESSIONS[0];
    startTime = fallback.startTime;
    endTime = fallback.endTime;
  }

  const [fsH, fsM] = startTime.split(':').map(Number);
  const [feH, feM] = endTime.split(':').map(Number);
  const duration = Math.max(1, (feH * 60 + feM) - (fsH * 60 + fsM));

  const lateGrace = Math.min(duration - 1, Math.max(0, Number(session.lateGraceMinutes ?? 15) || 15));
  const lateCutoffTime = addMinutesToTime(startTime, lateGrace);

  const earlyTol = Math.min(duration - 1, Math.max(0, Number(session.earlyDepartureToleranceMinutes ?? 10) || 10));
  const earlyDepartureCutoffTime = addMinutesToTime(endTime, -earlyTol);

  const absenceMinutes = Math.min(duration, Math.max(1, Number(session.absenceCutoffMinutes ?? 90) || 90));
  let absenceCutoffTime = session.absenceCutoffTime || addMinutesToTime(startTime, absenceMinutes);
  if (isTimeBefore(absenceCutoffTime, startTime) || isTimeAfter(absenceCutoffTime, endTime)) {
    absenceCutoffTime = addMinutesToTime(startTime, Math.min(duration, Math.max(15, absenceMinutes)));
  }

  let earliestCheckIn = session.earliestCheckinTime || addMinutesToTime(startTime, -60);
  if (isTimeAfter(earliestCheckIn, startTime)) {
    earliestCheckIn = addMinutesToTime(startTime, -60);
  }

  let latestCheckOut = session.latestCheckoutTime || addMinutesToTime(endTime, 60);
  if (isTimeBefore(latestCheckOut, endTime)) {
    latestCheckOut = addMinutesToTime(endTime, 60);
  }

  return {
    expectedStartTime: startTime,
    lateCutoffTime,
    expectedEndTime: endTime,
    earlyDepartureCutoffTime,
    absenceCutoffTime,
    earliestCheckIn,
    latestCheckOut,
  };
}

/**
 * Normalise session key: lowercase + trimmed, default to 'daily'.
 */
export function normaliseSessionKey(raw?: string | null): string {
  if (!raw || raw.trim() === '') return 'daily';
  return raw.toLowerCase().trim();
}

/**
 * Check-in for a staff member (self or admin-assisted)
 * Supports both daily and session-based modes.
 */
export async function checkIn(userId: string, schoolId: string, data: {
  date?: string;
  session?: string;   // optional – 'daily' for daily mode, or session id for session mode
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId, is_active: true }
  });
  if (!user) {
    throw new Error('Staff member not found or inactive in this school');
  }

  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';

  // 1. Geofence Verification (using shared validator)
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

  // 2. Face Verification Enforcement
  const isFaceRequired = settings?.staff_face_required ?? true;
  if (isFaceRequired && !data.faceVerified) {
    throw new Error('Face verification failed or is required for staff check-in.');
  }

  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);
  const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // ── Resolve session key and thresholds based on mode ──
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
    // Daily mode
    sessionKey = 'daily';
    const schedule = computeWorkingScheduleThresholds(settings);
    expectedEndTime = schedule.expectedEndTime;
    lateCutoffTime = schedule.lateCutoffTime;
    earliestCheckIn = schedule.earliestCheckIn;
    absenceCutoffTime = schedule.absenceCutoffTime;
    allowCheckinAfterCutoff = (settings as any)?.allow_staff_checkin_after_cutoff ?? false;
  }

  // 1. Earliest check-in gate: Check-in is inactive / rejected until earliestCheckIn
  if (earliestCheckIn && isTimeBefore(currentTimeHHMM, earliestCheckIn)) {
    throw new Error(`Check-in is not open yet. Earliest allowed check-in is ${formatCivilTime(earliestCheckIn)}.`);
  }

  // 2. Checkout Time — Final Check-in Lock (Regardless of allowCheckinAfterCutoff)
  if (expectedEndTime && (isTimeAfter(currentTimeHHMM, expectedEndTime) || currentTimeHHMM === expectedEndTime)) {
    throw new Error(`Check-in closed for today. The checkout time (${formatCivilTime(expectedEndTime)}) has passed.`);
  }

  // 3. Absence cutoff gate: If admin does not allow post-cutoff check-in, reject check-in
  if (!allowCheckinAfterCutoff && absenceCutoffTime && isTimeAfter(currentTimeHHMM, absenceCutoffTime)) {
    throw new Error(`Check-in closed for today. The absence cutoff time (${formatCivilTime(absenceCutoffTime)}) has passed.`);
  }

  // Determine status & remarks based on working day calendar rules
  let status = 'PRESENT';
  let remarks = data.remarks || null;

  if (workingDayInfo.isWorkingDay) {
    if (isTimeAfter(currentTimeHHMM, lateCutoffTime)) {
      status = 'LATE';
    }
  } else {
    // Non-working day or holiday check-in (optional work / special shift)
    status = 'PRESENT';
    const nonWorkNote = workingDayInfo.isHoliday
      ? `Holiday Attendance (${workingDayInfo.holidayName})`
      : `Weekend/Non-Working Day Attendance (${workingDayInfo.dayOfWeek})`;
    remarks = remarks ? `${remarks} | ${nonWorkNote}` : nonWorkNote;
  }

  // Check existing attendance for today+session
  const existing = await prisma.staffAttendance.findFirst({
    where: {
      schoolId,
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
      schoolId,
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
export async function checkOut(userId: string, schoolId: string, data: {
  date?: string;
  session?: string;   // optional – required in session mode
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
  locationDistance?: number | null;
  faceVerified?: boolean;
  faceConfidence?: number | null;
  remarks?: string;
}) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';

  // Geofence
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

  // Face
  const isFaceRequired = settings?.staff_face_required ?? true;
  if (isFaceRequired && !data.faceVerified) {
    throw new Error('Face verification failed or is required for staff check-out.');
  }

  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);
  const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // ── Resolve session key and early departure threshold ──
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
      schoolId,
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

  // Check early departure only if it is a scheduled working day
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
export async function enrollFace(adminUserId: string, targetUserId: string, schoolId: string, descriptor: number[]) {
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
    throw new Error('Valid face descriptor array is required for enrollment');
  }

  const staff = await prisma.user.findFirst({
    where: { id: targetUserId, schoolId }
  });
  if (!staff) {
    throw new Error('Staff member not found in this school');
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
      schoolId,
      userId: targetUserId,
      descriptor,
      enrolledBy: adminUserId,
    }
  });
}

/**
 * Retrieve face descriptor for client-side matching
 */
export async function getEnrolledDescriptor(userId: string, schoolId: string) {
  const enrollment = await prisma.staffFaceEnrollment.findFirst({
    where: { userId, schoolId }
  });
  return enrollment;
}

/**
 * Get staff attendance list (admin view)
 */
export async function getStaffAttendance(schoolId: string, filters: {
  date?: string;
  startDate?: string;
  endDate?: string;
  role?: string;
  userId?: string;
  status?: string;
  session?: string;   // filter by session ('daily', 'morning', 'afternoon', 'all')
  mode?: string;      // optional explicit mode ('daily' | 'session_based')
  search?: string;
  geofenceVerified?: string | boolean;
  faceVerified?: string | boolean;
}) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = filters.mode || (settings as any)?.staff_attendance_mode || 'daily';

  // If querying for a specific date (or today), evaluate any elapsed absence cutoffs first
  if (filters.date) {
    try {
      await processAutomaticStaffAbsences({
        schoolId,
        date: filters.date,
        session: filters.session,
      });
    } catch (autoErr) {
      console.warn('[StaffAttendance] Auto absence check failed during getStaffAttendance:', autoErr);
    }
  }

  const where: any = { schoolId };

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

  // Strict Mode and Session Enforcement
  if (attendanceMode === 'daily') {
    where.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    // Session-based mode: filter to specific session or all non-daily sessions
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
 * In session-based mode, returns per-session breakdown.
 */
export async function getStaffAttendanceStats(schoolId: string, date?: string, session?: string) {
  const { dateStr, startDate, endDate } = normalizeStaffDate(date);

  // If querying for a specific date (or today), evaluate any elapsed absence cutoffs first
  try {
    await processAutomaticStaffAbsences({
      schoolId,
      date: dateStr,
      session,
    });
  } catch (autoErr) {
    console.warn('[StaffAttendance] Auto absence check failed during getStaffAttendanceStats:', autoErr);
  }

  // Fetch settings once, pass cache to both helpers
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';

  // Total active staff (all non-parent/student users registered in this school)
  const totalStaffCount = await prisma.user.count({
    where: {
      schoolId,
      is_active: true,
      role: { notIn: ['parent', 'student'] }
    }
  });

  const recordWhere: any = { schoolId, date: { gte: startDate, lte: endDate } };
  
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

  // Current time in Africa/Addis_Ababa
  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const isToday = dateStr === new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' });

  // Compute cutoff threshold for stats overview
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

  // Unique staff who have any record for this date (avoid double-counting in session mode)
  const uniqueStaffIds = new Set(records.map((r: any) => r.userId));
  const notCheckedIn = Math.max(0, totalStaffCount - uniqueStaffIds.size);

  // Lifecycle breakdown for unrecorded staff:
  let notStarted = 0;
  let pendingCheckIn = 0;

  if (workingDayInfo.isWorkingDay) {
    if (isToday) {
      if (isTimeBefore(currentTimeHHMM, activeStartTime)) {
        notStarted = notCheckedIn;
      } else if (isTimeBefore(currentTimeHHMM, activeAbsenceCutoff)) {
        pendingCheckIn = notCheckedIn;
      } else {
        // Cutoff passed -> unrecorded are marked absent by processAutomaticStaffAbsences
      }
    }
  }

  // Session-breakdown for session_based mode
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
export async function getMyAttendance(userId: string, schoolId: string, filters: {
  startDate?: string;
  endDate?: string;
  date?: string;
  session?: string;
  mode?: string;
}) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = filters.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const where: any = { schoolId, userId };

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
}>, schoolId: string) {
  const results: any[] = [];
  const errors: string[] = [];

  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
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

      // Determine if this is a working day (reuse settings cache)
      const workingDayInfo = await isDateWorkingDay(schoolId, dateStr, settings);

      const existing = await prisma.staffAttendance.findFirst({
        where: {
          schoolId,
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
          // Non-working day offline check-in — mark present but annotate
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
              schoolId,
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
          // Apply early departure check only on scheduled working days
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
 * Admin manual marking of absent staff for a given date (and optional session).
 */
export async function markAbsentStaff(
  adminUserId: string,
  schoolId: string,
  userIds: string[],
  date: string,
  remarks?: string,
  session?: string
) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';
  const { startDate, endDate } = normalizeStaffDate(date);
  const sessionKey = attendanceMode === 'session_based' ? normaliseSessionKey(session) : 'daily';
  const results: any[] = [];

  for (const userId of userIds) {
    const existing = await prisma.staffAttendance.findFirst({
      where: {
        schoolId,
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
          schoolId,
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
  schoolId: string,
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

  const existing = await prisma.staffAttendance.findFirst({
    where: { id: recordId, schoolId },
    include: { user: true }
  });

  if (!existing) {
    throw new Error('Staff attendance record not found in this school');
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
 * Respects the configured staff attendance mode:
 *  - Daily mode   → always stores with session = 'daily'
 *  - Session mode → uses the provided session, required
 */
export async function setLeaveOrPermission(
  adminUserId: string,
  userId: string,
  schoolId: string,
  data: {
    date: string;
    status: 'LEAVE' | 'PERMISSION';
    reason: string;
    session?: string;
    mode?: string;  // optional override; defaults to school setting
  }
) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = data.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const { startDate, endDate } = normalizeStaffDate(data.date);

  // Enforce mode-correct session key
  let sessionKey: string;
  if (attendanceMode === 'session_based') {
    sessionKey = normaliseSessionKey(data.session) || 'morning';
  } else {
    sessionKey = 'daily';
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      schoolId,
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
      schoolId,
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
 * Strictly respects the configured staff attendance mode — never mixes daily and session records.
 */
export async function getStaffAttendanceReport(
  schoolId: string,
  filters: {
    startDate: string;
    endDate: string;
    role?: string;
    userId?: string;
    mode?: string;      // 'daily' | 'session_based' — defaults to school setting
    session?: string;   // optional session filter in session_based mode
  }
) {
  const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
  const attendanceMode = filters.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const { startDate } = normalizeStaffDate(filters.startDate);
  const { endDate } = normalizeStaffDate(filters.endDate);

  const where: any = {
    schoolId,
    date: { gte: startDate, lte: endDate }
  };

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.role && filters.role !== 'all') {
    where.user = { role: filters.role };
  }

  // ── Mode-strict session filter (mirrors logic in getStaffAttendance) ──
  if (attendanceMode === 'daily') {
    where.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    // session_based: filter to a specific session or all non-daily sessions
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

  // Aggregate by staff member
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

  // Daily totals summary
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
 * Strictly respects:
 * 1. Working days, weekends, and holidays (never marks absent on non-working days/holidays)
 * 2. Approved leaves, permissions, and manual corrections (never overwrites approved leave/permission)
 * 3. Session independence (morning/afternoon sessions evaluated separately)
 * 4. Cutoff time lifecycle (before cutoff -> pending, only after cutoff -> absent)
 * 5. Active staff eligibility (only active non-parent/student staff in school)
 * 6. Idempotency (safe to run repeatedly, will not duplicate or corrupt records)
 */
export async function processAutomaticStaffAbsences(options?: {
  schoolId?: string;
  date?: string;
  session?: string;
  force?: boolean;
}) {
  const { dateStr, startDate, endDate } = normalizeStaffDate(options?.date);

  const schoolQuery = options?.schoolId ? { id: options.schoolId } : {};
  const schools = await prisma.school.findMany({
    where: schoolQuery,
    select: { id: true, name: true }
  });

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
    schoolsEvaluated: schools.length,
    totalEligibleStaff: 0,
    alreadyRecorded: 0,
    markedAbsent: 0,
    skippedNonWorking: 0,
    skippedBeforeCutoff: 0,
    details: [] as any[],
  };

  for (const school of schools) {
    const settings = await prisma.schoolSettings.findUnique({ where: { schoolId: school.id } });
    const workingDayInfo = await isDateWorkingDay(school.id, dateStr, settings);

    // Rule: Never mark absences on non-working days or holidays
    if (!workingDayInfo.isWorkingDay) {
      summary.skippedNonWorking++;
      summary.details.push({
        schoolId: school.id,
        schoolName: school.name,
        status: 'SKIPPED_NON_WORKING_DAY',
        reason: workingDayInfo.reason || (workingDayInfo.isHoliday ? `Holiday: ${workingDayInfo.holidayName}` : 'Non-working day')
      });
      continue;
    }

    const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';
    const eligibleStaff = await prisma.user.findMany({
      where: {
        schoolId: school.id,
        is_active: true,
        role: { notIn: ['parent', 'student'] }
      },
      select: { id: true, full_name: true, role: true, email: true }
    });

    summary.totalEligibleStaff += eligibleStaff.length;
    if (eligibleStaff.length === 0) continue;

    // Determine sessions to process
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
      // Check if absence cutoff has passed (if date is today, check time; if date is in the past, cutoff has definitely passed)
      const cutoffPassed = !isToday || isTimeAfter(currentTimeHHMM, sessionConfig.absenceCutoffTime) || currentTimeHHMM === sessionConfig.absenceCutoffTime;

      if (!cutoffPassed && !options?.force) {
        summary.skippedBeforeCutoff++;
        summary.details.push({
          schoolId: school.id,
          session: sessionConfig.id,
          status: 'PENDING_CUTOFF',
          currentTime: currentTimeHHMM,
          absenceCutoffTime: sessionConfig.absenceCutoffTime,
          message: `Absence cutoff ${sessionConfig.absenceCutoffTime} has not elapsed yet.`
        });
        continue;
      }

      // Fetch existing records for this school, date, and session
      const existingRecords = await prisma.staffAttendance.findMany({
        where: {
          schoolId: school.id,
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
          // If staff has checked in, or has approved leave/permission, or already absent -> preserve
          if (existing.checkInTime || existing.status === 'LEAVE' || existing.status === 'PERMISSION' || existing.status === 'PRESENT' || existing.status === 'LATE' || existing.status === 'EARLY_DEPARTURE') {
            summary.alreadyRecorded++;
            continue;
          }
          if (existing.status === 'ABSENT') {
            summary.alreadyRecorded++;
            continue;
          }

          // Unrecorded placeholder -> update to ABSENT
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
          // No record exists -> create ABSENT record
          await prisma.staffAttendance.create({
            data: {
              schoolId: school.id,
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
        schoolId: school.id,
        schoolName: school.name,
        session: sessionConfig.id,
        markedAbsent: schoolSessionMarked,
        absenceCutoffTime: sessionConfig.absenceCutoffTime,
      });
    }
  }

  return summary;
}

