import prisma from '../config/db';
import { validateGeofence } from './attendance.service';
import { isDateWorkingDay, addMinutesToTime, buildNonWorkingDayReason } from './holiday.service';
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
 * 1:1 Biometric Verification: Compares live face descriptor against enrolled profile.
 * Dual-metric requirement: L2 Euclidean distance <= 0.38 AND Cosine similarity >= 0.90
 */
export function verifyDescriptorMatch(
  liveDescriptor: number[],
  enrolledDescriptor: number[],
  maxDistance = 0.38,
  minCosine = 0.90
): { isMatch: boolean; distance: number; cosineSim: number } {
  if (
    !liveDescriptor ||
    !enrolledDescriptor ||
    !Array.isArray(liveDescriptor) ||
    !Array.isArray(enrolledDescriptor) ||
    liveDescriptor.length !== 128 ||
    enrolledDescriptor.length !== 128
  ) {
    return { isMatch: false, distance: 1.0, cosineSim: 0 };
  }

  let normLiveSq = 0;
  let normEnrolledSq = 0;
  for (let i = 0; i < 128; i++) {
    const l = liveDescriptor[i];
    const e = enrolledDescriptor[i];
    if (typeof l !== 'number' || typeof e !== 'number' || isNaN(l) || isNaN(e) || !isFinite(l) || !isFinite(e)) {
      return { isMatch: false, distance: 1.0, cosineSim: 0 };
    }
    normLiveSq += l * l;
    normEnrolledSq += e * e;
  }

  const normLive = Math.sqrt(normLiveSq);
  const normEnrolled = Math.sqrt(normEnrolledSq);

  if (normLive === 0 || normEnrolled === 0 || isNaN(normLive) || isNaN(normEnrolled)) {
    return { isMatch: false, distance: 1.0, cosineSim: 0 };
  }

  let dot = 0;
  let distSq = 0;
  for (let i = 0; i < 128; i++) {
    const l = liveDescriptor[i] / normLive;
    const e = enrolledDescriptor[i] / normEnrolled;
    dot += l * e;
    const diff = l - e;
    distSq += diff * diff;
  }

  const distance = Math.sqrt(distSq);
  const cosineSim = Math.max(-1.0, Math.min(1.0, dot));

  const isMatch = distance <= maxDistance && cosineSim >= minCosine;
  return {
    isMatch,
    distance: Math.round(distance * 1000) / 1000,
    cosineSim: Math.round(cosineSim * 1000) / 1000,
  };
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
        startTime: s.startTime || s.start_time || s.start || '08:00',
        endTime: s.endTime || s.end_time || s.end || '12:30',
        lateGraceMinutes: Number(s.lateGraceMinutes ?? s.late_grace_minutes ?? s.grace ?? 15),
        earlyDepartureToleranceMinutes: Number(s.earlyDepartureToleranceMinutes ?? s.early_departure_tolerance_minutes ?? 15),
        absenceCutoffMinutes: Number(s.absenceCutoffMinutes ?? s.absence_cutoff_minutes ?? 60),
        // Preserve the absolute time strings saved by admin — these are used directly
        // by computeSessionThresholds instead of being re-computed from offsets.
        absenceCutoffTime: s.absenceCutoffTime || s.absence_cutoff_time || undefined,
        earliestCheckinTime: s.earliestCheckinTime || s.earliest_checkin_time || undefined,
        latestCheckoutTime: s.latestCheckoutTime || s.latest_checkout_time || undefined,
        // Fallback offset fields (only used when absolute times are absent)
        earliestCheckInOffsetMinutes: Number(s.earliestCheckInOffsetMinutes ?? 60),
        latestCheckOutOffsetMinutes: Number(s.latestCheckOutOffsetMinutes ?? 60),
        allowCheckinAfterCutoff: Boolean(s.allowCheckinAfterCutoff ?? s.allow_checkin_after_cutoff ?? false),
        isActive: s.isActive !== false,
      }));
    }
  } catch (err) {
    console.warn('[StaffAttendance] Failed to parse staff_sessions from settings, using default:', err);
  }
  return DEFAULT_STAFF_SESSIONS;
}

export function computeSessionThresholds(session: StaffSessionConfig & {
  absenceCutoffTime?: string;
  earliestCheckinTime?: string;
  latestCheckoutTime?: string;
}) {
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

  // Prefer absolute saved times over offset-based calculation.
  // This ensures admin-configured check-in windows are respected.
  const earliestCheckIn = session.earliestCheckinTime || addMinutesToTime(startTime, -earliestCheckInOffsetMinutes);
  const latestCheckOut = session.latestCheckoutTime || addMinutesToTime(endTime, latestCheckOutOffsetMinutes);
  const absenceCutoffTime = session.absenceCutoffTime || addMinutesToTime(startTime, absenceCutoffMinutes);

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

export const MAX_FACE_VERIFICATION_ATTEMPTS = 5;

let isAttemptTableInitialized = false;

export async function ensureStaffFaceAttemptTable() {
  if (isAttemptTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "staff_face_attempts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "session" TEXT NOT NULL DEFAULT 'daily',
        "attemptCount" INTEGER NOT NULL DEFAULT 0,
        "isLocked" BOOLEAN NOT NULL DEFAULT false,
        "lockedAt" TIMESTAMP(3),
        "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "staff_face_attempts_userId_date_session_key" 
      ON "staff_face_attempts"("userId", "date", "session");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "staff_face_attempts_userId_date_session_idx" 
      ON "staff_face_attempts"("userId", "date", "session");
    `);
    isAttemptTableInitialized = true;
  } catch (err) {
    console.warn('[StaffAttendance] ensureStaffFaceAttemptTable warning:', err);
    isAttemptTableInitialized = true;
  }
}

export async function getVerificationAttemptStatus(
  userId: string,
  dateInput?: string,
  sessionInput?: string,
  modeInput?: string
): Promise<{
  userId: string;
  date: string;
  session: string;
  attemptCount: number;
  maxAttempts: number;
  remainingAttempts: number;
  isLocked: boolean;
  lockMessage: string | null;
}> {
  await ensureStaffFaceAttemptTable();
  const { dateStr } = normalizeStaffDate(dateInput);
  const isSessionMode = modeInput === 'session_based';
  const sessionKey = isSessionMode ? normaliseSessionKey(sessionInput || 'morning') : 'daily';

  let record: any = null;
  try {
    const results: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "staff_face_attempts" WHERE "userId" = $1 AND "date" = $2 AND "session" = $3 LIMIT 1;`,
      userId,
      dateStr,
      sessionKey
    );
    record = results && results.length > 0 ? results[0] : null;
  } catch (err) {
    console.warn('[StaffAttendance] Error reading staff_face_attempts:', err);
  }

  const attemptCount = record ? Number(record.attemptCount || 0) : 0;
  const isLocked = Boolean(record?.isLocked || attemptCount >= MAX_FACE_VERIFICATION_ATTEMPTS);
  const remainingAttempts = Math.max(0, MAX_FACE_VERIFICATION_ATTEMPTS - attemptCount);

  let lockMessage: string | null = null;
  if (isLocked) {
    if (sessionKey === 'daily') {
      lockMessage = 'Maximum verification attempts reached. Please try again tomorrow.';
    } else {
      const sessLabel = sessionKey === 'morning' ? 'Morning' : sessionKey === 'afternoon' ? 'Afternoon' : sessionKey.toUpperCase();
      lockMessage = `Maximum verification attempts reached for the ${sessLabel} session. Please try again in the next session.`;
    }
  }

  return {
    userId,
    date: dateStr,
    session: sessionKey,
    attemptCount,
    maxAttempts: MAX_FACE_VERIFICATION_ATTEMPTS,
    remainingAttempts,
    isLocked,
    lockMessage,
  };
}

export async function recordFailedVerificationAttempt(
  userId: string,
  dateInput?: string,
  sessionInput?: string,
  modeInput?: string,
  _reason?: string
): Promise<{
  userId: string;
  date: string;
  session: string;
  attemptCount: number;
  maxAttempts: number;
  remainingAttempts: number;
  isLocked: boolean;
  lockMessage: string | null;
}> {
  await ensureStaffFaceAttemptTable();
  const { dateStr } = normalizeStaffDate(dateInput);
  const isSessionMode = modeInput === 'session_based';
  const sessionKey = isSessionMode ? normaliseSessionKey(sessionInput || 'morning') : 'daily';

  try {
    const id = `${userId}_${dateStr}_${sessionKey}`;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "staff_face_attempts" ("id", "userId", "date", "session", "attemptCount", "isLocked", "lockedAt", "lastAttemptAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 1, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "date", "session")
      DO UPDATE SET
        "attemptCount" = "staff_face_attempts"."attemptCount" + 1,
        "isLocked" = CASE WHEN ("staff_face_attempts"."attemptCount" + 1) >= 5 THEN true ELSE "staff_face_attempts"."isLocked" END,
        "lockedAt" = CASE WHEN ("staff_face_attempts"."attemptCount" + 1) >= 5 AND "staff_face_attempts"."lockedAt" IS NULL THEN CURRENT_TIMESTAMP ELSE "staff_face_attempts"."lockedAt" END,
        "lastAttemptAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP;
      `,
      id,
      userId,
      dateStr,
      sessionKey
    );
  } catch (err) {
    console.error('[StaffAttendance] Error recording failed attempt:', err);
  }

  return await getVerificationAttemptStatus(userId, dateStr, sessionKey, modeInput);
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
  faceDescriptor?: number[] | null;
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
  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);

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

  // ─── Enforce Maximum Verification Attempts Lock ───────────────────────────
  const attemptStatus = await getVerificationAttemptStatus(userId, dateStr, sessionKey, attendanceMode);
  if (attemptStatus.isLocked) {
    throw new Error(attemptStatus.lockMessage || 'Maximum verification attempts reached. Please try again tomorrow.');
  }

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
  if (isFaceRequired) {
    // 1:1 Biometric Verification: authenticated staff account -> registered template -> live face
    const enrollment = await prisma.staffFaceEnrollment.findFirst({
      where: { userId }
    });

    if (!enrollment || !enrollment.descriptor) {
      throw new Error('Face biometric profile not registered for your account. Please enroll your face first.');
    }

    if (!data.faceVerified) {
      await recordFailedVerificationAttempt(userId, dateStr, sessionKey, attendanceMode, 'Face mismatch');
      throw new Error('Face does not match your registered profile. Attendance was not recorded.');
    }

    let enrolledVector: number[] = [];
    if (Array.isArray(enrollment.descriptor)) {
      enrolledVector = enrollment.descriptor as unknown as number[];
    } else if (enrollment.descriptor && typeof enrollment.descriptor === 'object' && Array.isArray((enrollment.descriptor as any).vector)) {
      enrolledVector = (enrollment.descriptor as any).vector;
    }

    if (enrolledVector.length !== 128) {
      throw new Error('Corrupted registered biometric profile. Please re-enroll your face.');
    }

    // Cryptographic 1:1 server-side verification if live faceDescriptor is attached
    if (data.faceDescriptor && Array.isArray(data.faceDescriptor)) {
      const match = verifyDescriptorMatch(data.faceDescriptor, enrolledVector);
      if (!match.isMatch) {
        await recordFailedVerificationAttempt(userId, dateStr, sessionKey, attendanceMode, 'Biometric descriptor mismatch');
        throw new Error('Face does not match your registered profile. Attendance was not recorded.');
      }
    }
  }

  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

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

  if (!workingDayInfo.isWorkingDay) {
    // Hard block: staff cannot check in on holidays or non-working days
    const displayReason = workingDayInfo.displayReason || buildNonWorkingDayReason(workingDayInfo);
    const err: any = new Error(`Check-in is not available: ${displayReason}`);
    err.code = 'NON_WORKING_DAY';
    err.displayReason = displayReason;
    err.isHoliday = workingDayInfo.isHoliday;
    err.isWeekend = workingDayInfo.isWeekend;
    throw err;
  }

  if (isTimeAfter(currentTimeHHMM, lateCutoffTime)) {
    status = 'LATE';
  }

  const existing = await prisma.staffAttendance.findFirst({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      session: sessionKey,
    }
  });

  if (existing && existing.checkInTime) {
    throw new Error('Attendance check-in has already been recorded for this session.');
  }

  const result = await prisma.staffAttendance.upsert({
    where: {
      userId_date_session: {
        userId,
        date: startDate,
        session: sessionKey,
      }
    },
    create: {
      userId,
      date: startDate,
      session: sessionKey,
      status,
      checkInTime: now,
      checkInLatitude: data.latitude,
      checkInLongitude: data.longitude,
      geofenceVerified: locVerified,
      geofenceDistance: locDistance,
      faceVerified: data.faceVerified ?? false,
      faceConfidence: data.faceConfidence,
      remarks,
    },
    update: {
      status,
      checkInTime: now,
      checkInLatitude: data.latitude,
      checkInLongitude: data.longitude,
      geofenceVerified: locVerified,
      geofenceDistance: locDistance,
      faceVerified: data.faceVerified ?? false,
      faceConfidence: data.faceConfidence,
      remarks,
    },
    include: {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          profile_photo: true,
        }
      }
    }
  });

  return result;
}

/**
 * Check-out for a staff member (self or admin-assisted)
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
  faceDescriptor?: number[] | null;
  remarks?: string;
} = {}) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = (settings as any)?.staff_attendance_mode ?? 'daily';
  const { dateStr, startDate, endDate } = normalizeStaffDate(data.date);

  let sessionKey: string;
  let earlyDepartureCutoffTime: string;
  let latestCheckOutTime: string;

  if (attendanceMode === 'session_based') {
    if (!data.session) throw new Error('Session is required when staff attendance mode is session-based.');
    const sessions = getConfiguredSessions(settings);
    const sess = findSession(sessions, data.session);
    if (!sess) throw new Error(`Session "${data.session}" is not configured or is inactive.`);
    sessionKey = sess.id.toLowerCase();
    const thresholds = computeSessionThresholds(sess);
    earlyDepartureCutoffTime = thresholds.earlyDepartureCutoffTime;
    latestCheckOutTime = thresholds.latestCheckOut;
  } else {
    sessionKey = 'daily';
    const schedule = computeWorkingScheduleThresholds(settings);
    earlyDepartureCutoffTime = schedule.earlyDepartureCutoffTime;
    latestCheckOutTime = schedule.latestCheckOut;
  }

  // ─── Enforce Maximum Verification Attempts Lock ───────────────────────────
  const attemptStatus = await getVerificationAttemptStatus(userId, dateStr, sessionKey, attendanceMode);
  if (attemptStatus.isLocked) {
    throw new Error(attemptStatus.lockMessage || 'Maximum verification attempts reached. Please try again tomorrow.');
  }

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
  if (isFaceRequired) {
    // 1:1 Biometric Verification: authenticated staff account -> registered template -> live face
    const enrollment = await prisma.staffFaceEnrollment.findFirst({
      where: { userId }
    });

    if (!enrollment || !enrollment.descriptor) {
      throw new Error('Face biometric profile not registered for your account. Please enroll your face first.');
    }

    if (!data.faceVerified) {
      await recordFailedVerificationAttempt(userId, dateStr, sessionKey, attendanceMode, 'Face mismatch');
      throw new Error('Face does not match your registered profile. Attendance was not recorded.');
    }

    let enrolledVector: number[] = [];
    if (Array.isArray(enrollment.descriptor)) {
      enrolledVector = enrollment.descriptor as unknown as number[];
    } else if (enrollment.descriptor && typeof enrollment.descriptor === 'object' && Array.isArray((enrollment.descriptor as any).vector)) {
      enrolledVector = (enrollment.descriptor as any).vector;
    }

    if (enrolledVector.length !== 128) {
      throw new Error('Corrupted registered biometric profile. Please re-enroll your face.');
    }

    // Cryptographic 1:1 server-side verification if live faceDescriptor is attached
    if (data.faceDescriptor && Array.isArray(data.faceDescriptor)) {
      const match = verifyDescriptorMatch(data.faceDescriptor, enrolledVector);
      if (!match.isMatch) {
        await recordFailedVerificationAttempt(userId, dateStr, sessionKey, attendanceMode, 'Biometric descriptor mismatch');
        throw new Error('Face does not match your registered profile. Attendance was not recorded.');
      }
    }
  }

  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);

  if (!workingDayInfo.isWorkingDay) {
    const displayReason = workingDayInfo.displayReason || buildNonWorkingDayReason(workingDayInfo);
    const err: any = new Error(`Check-out is not available: ${displayReason}`);
    err.code = 'NON_WORKING_DAY';
    err.displayReason = displayReason;
    err.isHoliday = workingDayInfo.isHoliday;
    err.isWeekend = workingDayInfo.isWeekend;
    throw err;
  }

  const now = new Date();
  const currentTimeHHMM = now.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Addis_Ababa', 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  if (latestCheckOutTime && isTimeAfter(currentTimeHHMM, latestCheckOutTime)) {
    const sessLabel = attendanceMode === 'session_based' ? ` for the ${sessionKey} session` : ' for today';
    throw new Error(`Check-out is closed${sessLabel}. The latest checkout time (${formatCivilTime(latestCheckOutTime)}) has passed.`);
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
 * Face enrollment for a staff member (admin or self-service)
 * Enforces strong duplication prevention:
 * 1. Checks if the target staff member already has a profile (rejects unless replaceExisting is true).
 * 2. Checks if the biometric template is already registered to any OTHER staff member (cross-account duplicate detection).
 * 3. Uses a database transaction to prevent concurrent race conditions.
 * 4. Logs an audit trail on creation and replacement.
 */
export async function enrollFace(
  adminUserId: string,
  targetUserId: string,
  _schoolId?: string,
  descriptor?: number[],
  replaceExisting = false
) {
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    throw new Error('Invalid face descriptor: exactly 128 numerical feature values are required.');
  }

  // Validate all elements are finite numbers
  let sumSq = 0;
  for (let i = 0; i < descriptor.length; i++) {
    const val = descriptor[i];
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
      throw new Error(`Corrupted biometric descriptor: invalid value at index ${i}`);
    }
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq);
  if (norm < 0.1 || norm > 3.0) {
    throw new Error('Biometric descriptor norm is out of acceptable bounds.');
  }

  // Ensure normalized unit vector (L2-norm = 1.0)
  const normalizedDescriptor = descriptor.map(v => v / norm);

  const staff = await prisma.user.findFirst({
    where: { id: targetUserId }
  });
  if (!staff) {
    throw new Error('Staff member not found');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Check if the target staff member already has an enrolled profile
    const existingEnrollment = await tx.staffFaceEnrollment.findUnique({
      where: { userId: targetUserId }
    });

    if (existingEnrollment && !replaceExisting) {
      throw new Error('Biometric profile already registered for this staff member.');
    }

    // 2. Cross-account duplicate detection:
    // Check if this captured face is already registered to ANY OTHER staff member
    const otherEnrollments = await tx.staffFaceEnrollment.findMany({
      where: { userId: { not: targetUserId } }
    });

    for (const other of otherEnrollments) {
      let otherVec: number[] = [];
      if (Array.isArray(other.descriptor)) {
        otherVec = other.descriptor as unknown as number[];
      } else if (other.descriptor && typeof other.descriptor === 'object' && Array.isArray((other.descriptor as any).vector)) {
        otherVec = (other.descriptor as any).vector;
      }

      if (otherVec.length === 128) {
        const match = verifyDescriptorMatch(normalizedDescriptor, otherVec);
        if (match.isMatch) {
          const err: any = new Error('This face is already registered to another staff member.');
          err.code = 'FACE_ALREADY_REGISTERED';
          throw err;
        }
      }
    }

    // 3. Perform the enrollment / update
    let result: any;
    if (existingEnrollment) {
      result = await tx.staffFaceEnrollment.update({
        where: { userId: targetUserId },
        data: {
          descriptor: normalizedDescriptor,
          enrolledBy: adminUserId,
          updatedAt: new Date(),
        }
      });

      // 4. Audit trail for replacement / re-registration
      await tx.auditLog.create({
        data: {
          user_id: adminUserId,
          action: 'STAFF_FACE_RE_ENROLLED',
          entity_type: 'staff_face_enrollment',
          entity_id: existingEnrollment.id,
          old_values: {
            enrolledAt: existingEnrollment.enrolledAt,
            enrolledBy: existingEnrollment.enrolledBy,
            targetUserId,
          },
          new_values: {
            replacedBy: adminUserId,
            replacedAt: new Date(),
            targetUserId,
          },
        }
      });
    } else {
      result = await tx.staffFaceEnrollment.create({
        data: {
          userId: targetUserId,
          descriptor: normalizedDescriptor,
          enrolledBy: adminUserId,
        }
      });

      // Audit trail for initial enrollment
      await tx.auditLog.create({
        data: {
          user_id: adminUserId,
          action: 'STAFF_FACE_ENROLLED',
          entity_type: 'staff_face_enrollment',
          entity_id: targetUserId,
          new_values: {
            enrolledBy: adminUserId,
            enrolledAt: new Date(),
            targetUserId,
          },
        }
      });
    }

    return result;
  });
}

/**
 * Retrieve face descriptor for client-side matching
 */
export async function getEnrolledDescriptor(userId: string, _schoolId?: string) {
  const enrollment = await prisma.staffFaceEnrollment.findFirst({
    where: { userId }
  });

  if (!enrollment) return null;

  // Normalize return shape if descriptor is wrapped
  let descriptorArray: number[] = [];
  if (Array.isArray(enrollment.descriptor)) {
    descriptorArray = enrollment.descriptor as unknown as number[];
  } else if (enrollment.descriptor && typeof enrollment.descriptor === 'object' && Array.isArray((enrollment.descriptor as any).vector)) {
    descriptorArray = (enrollment.descriptor as any).vector;
  }

  return {
    ...enrollment,
    descriptor: descriptorArray,
  };
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
  
  if (session && session !== 'all' && session !== 'ALL') {
    recordWhere.session = normaliseSessionKey(session);
  } else if (attendanceMode === 'daily') {
    recordWhere.OR = [{ session: 'daily' }, { session: null }, { session: '' }];
  } else {
    recordWhere.AND = [
      { session: { not: null } },
      { session: { not: '' } },
      { session: { not: 'daily' } }
    ];
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

  if (attendanceMode === 'session_based' || (session && session !== 'all' && session !== 'ALL')) {
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
    displayReason: workingDayInfo.displayReason || buildNonWorkingDayReason(workingDayInfo),
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

      if (!workingDayInfo.isWorkingDay) {
        const displayReason = workingDayInfo.displayReason || buildNonWorkingDayReason(workingDayInfo);
        errors.push(`Skipped record for staff on ${dateStr}: ${displayReason}`);
        continue;
      }

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

        if (isTimeAfter(timeHHMM, schedule.lateCutoffTime)) {
          status = 'LATE';
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
  const { dateStr, startDate, endDate } = normalizeStaffDate(date);
  const workingDayInfo = await isDateWorkingDay(undefined, dateStr, settings);
  if (!workingDayInfo.isWorkingDay) {
    const displayReason = workingDayInfo.displayReason || buildNonWorkingDayReason(workingDayInfo);
    throw new Error(`Cannot mark staff absent on a non-working day: ${displayReason}`);
  }
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
    date?: string;
    startDate?: string;
    endDate?: string;
    status: 'LEAVE' | 'PERMISSION';
    reason: string;
    session?: string;
    mode?: string;
  }
) {
  const settings = await prisma.schoolSettings.findFirst();
  const attendanceMode = data.mode || (settings as any)?.staff_attendance_mode || 'daily';

  const fromDateStr = (data.startDate || data.date || '').trim();
  const toDateStr = (data.endDate || data.startDate || data.date || '').trim();

  if (!fromDateStr) {
    throw new Error('Date is required to set leave or permission.');
  }

  const startD = new Date(fromDateStr + 'T00:00:00Z');
  const endD = new Date(toDateStr + 'T00:00:00Z');
  if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
    throw new Error('Invalid date format provided.');
  }
  if (startD > endD) {
    throw new Error('Start date cannot be after end date.');
  }

  // Determine which sessions to record for
  let sessionKeys: string[] = [];
  if (attendanceMode === 'session_based') {
    if (!data.session || data.session === 'all' || data.session === 'ALL') {
      let parsedSessions = ['morning', 'afternoon'];
      if ((settings as any)?.staffSessions) {
        try {
          const raw = typeof (settings as any).staffSessions === 'string'
            ? JSON.parse((settings as any).staffSessions)
            : (settings as any).staffSessions;
          if (Array.isArray(raw) && raw.length > 0) {
            parsedSessions = raw.filter((s: any) => s && s.isActive !== false).map((s: any) => normaliseSessionKey(s.id));
          }
        } catch (_) {}
      }
      sessionKeys = parsedSessions.length > 0 ? parsedSessions : ['morning', 'afternoon'];
    } else {
      sessionKeys = [normaliseSessionKey(data.session) || 'morning'];
    }
  } else {
    sessionKeys = ['daily'];
  }

  const results: any[] = [];
  const current = new Date(startD);
  let safetyCounter = 366; // Maximum 1 year limit

  while (current <= endD && safetyCounter > 0) {
    safetyCounter--;
    const dStr = current.toISOString().split('T')[0];
    const { startDate: dayStart, endDate: dayEnd } = normalizeStaffDate(dStr);

    for (const sessKey of sessionKeys) {
      const existing = await prisma.staffAttendance.findFirst({
        where: {
          userId,
          date: { gte: dayStart, lte: dayEnd },
          session: sessKey,
        }
      });

      if (existing) {
        const updated = await prisma.staffAttendance.update({
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
        results.push(updated);
      } else {
        const created = await prisma.staffAttendance.create({
          data: {
            userId,
            date: dayStart,
            session: sessKey,
            status: data.status,
            remarks: data.reason,
            markedAbsentBy: adminUserId,
          }
        });
        results.push(created);
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    success: true,
    count: results.length,
    startDate: fromDateStr,
    endDate: toDateStr,
    status: data.status,
    records: results,
  };
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
    status?: string;
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

  if (filters.status && filters.status !== 'all' && filters.status !== 'ALL') {
    if (filters.status.toUpperCase() === 'LEAVE_PERMISSION') {
      where.status = { in: ['LEAVE', 'PERMISSION'] };
    } else {
      where.status = filters.status.toUpperCase();
    }
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
        permission: 0,
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
    else if (r.status === 'PERMISSION') {
      item.permission++;
      item.onLeave++;
    } else if (r.status === 'LEAVE') {
      item.onLeave++;
    }

    if (r.geofenceVerified) item.geoVerified++;
    if (r.faceVerified) item.faceVerified++;
    item.records.push(r);
  }

  const dayMap = new Map<string, { date: string; present: number; late: number; absent: number; earlyDeparture: number; onLeave: number; permission: number; total: number }>();
  for (const r of records) {
    const dStr = r.date.toISOString().split('T')[0];
    if (!dayMap.has(dStr)) {
      dayMap.set(dStr, { date: dStr, present: 0, late: 0, absent: 0, earlyDeparture: 0, onLeave: 0, permission: 0, total: 0 });
    }
    const d = dayMap.get(dStr)!;
    d.total++;
    if (r.status === 'PRESENT') d.present++;
    else if (r.status === 'LATE') d.late++;
    else if (r.status === 'ABSENT') d.absent++;
    else if (r.status === 'EARLY_DEPARTURE') d.earlyDeparture++;
    else if (r.status === 'PERMISSION') {
      d.permission++;
      d.onLeave++;
    } else if (r.status === 'LEAVE') {
      d.onLeave++;
    }
  }

  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    attendanceMode,
    statusFilter: filters.status || 'ALL',
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
