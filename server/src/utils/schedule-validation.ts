/**
 * Schedule & Session Configuration Validation Engine (Server Authoritative)
 *
 * Implements authoritative validation for Morning, Afternoon, and Daily staff
 * attendance schedules on the backend to reject invalid, impossible, or overlapping
 * configuration before saving to the database.
 */

import { formatCivilTime } from "./ethiopian-time";

export interface StaffSessionConfig {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateGraceMinutes: number;
  earlyDepartureToleranceMinutes: number;
  absenceCutoffMinutes: number;
  absenceCutoffTime: string;
  earliestCheckinTime: string;
  latestCheckoutTime: string;
  isActive: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  sessionId?: 'morning' | 'afternoon' | 'daily';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  errorMap: Record<string, string>;
}

/**
 * Converts a canonical "HH:MM" 24h time string into minutes from midnight (0..1439).
 * Returns NaN if input format is invalid.
 */
export function timeToMinutes(timeHHMM?: string | null): number {
  if (!timeHHMM || typeof timeHHMM !== 'string') return NaN;
  const parts = timeHHMM.trim().split(':');
  if (parts.length < 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

/**
 * Adds minutes to an "HH:MM" string and returns a normalized "HH:MM" string.
 */
export function addMinutesToHHMM(timeHHMM: string, minutes: number): string {
  const mins = timeToMinutes(timeHHMM);
  if (isNaN(mins)) return '08:00';
  let total = mins + minutes;
  if (total < 0) total = 0;
  if (total >= 24 * 60) total = 24 * 60 - 1;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates the difference in minutes between timeA and timeB (timeA - timeB).
 */
export function getMinutesDiff(timeA: string, timeB: string): number {
  const mA = timeToMinutes(timeA);
  const mB = timeToMinutes(timeB);
  if (isNaN(mA) || isNaN(mB)) return 0;
  return mA - mB;
}

/**
 * Validates a single session's internal parameters.
 */
export function validateSingleSession(
  session: Partial<StaffSessionConfig>,
  sessionId: 'morning' | 'afternoon'
): ValidationError[] {
  const errors: ValidationError[] = [];
  const label = sessionId === 'morning' ? 'Morning' : 'Afternoon';

  const startMin = timeToMinutes(session.startTime);
  const endMin = timeToMinutes(session.endTime);

  // 1. Time Order: Start & End format and comparison
  if (isNaN(startMin)) {
    errors.push({
      field: `${sessionId}.startTime`,
      message: `${label} session start time is invalid.`,
      sessionId,
    });
  }
  if (isNaN(endMin)) {
    errors.push({
      field: `${sessionId}.endTime`,
      message: `${label} session end time is invalid.`,
      sessionId,
    });
  }

  if (!isNaN(startMin) && !isNaN(endMin)) {
    if (startMin >= endMin) {
      errors.push({
        field: `${sessionId}.endTime`,
        message: `${label} start time (${formatCivilTime(session.startTime)}) must be strictly before end time (${formatCivilTime(session.endTime)}). Overnight sessions are not allowed.`,
        sessionId,
      });
    }
  }

  const durationMin = !isNaN(startMin) && !isNaN(endMin) ? endMin - startMin : 0;

  // 2. Grace Period Validation
  const grace = Number(session.lateGraceMinutes);
  if (isNaN(grace) || grace < 0 || !Number.isInteger(grace)) {
    errors.push({
      field: `${sessionId}.lateGraceMinutes`,
      message: `${label} late grace period must be a non-negative whole number of minutes.`,
      sessionId,
    });
  } else if (durationMin > 0 && grace >= durationMin) {
    errors.push({
      field: `${sessionId}.lateGraceMinutes`,
      message: `${label} late grace period (${grace} min) must be less than session duration (${durationMin} min). Late threshold cannot exceed session end time.`,
      sessionId,
    });
  }

  // 3. Early Departure Tolerance Validation
  const tol = Number(session.earlyDepartureToleranceMinutes);
  if (isNaN(tol) || tol < 0 || !Number.isInteger(tol)) {
    errors.push({
      field: `${sessionId}.earlyDepartureToleranceMinutes`,
      message: `${label} early departure tolerance must be a non-negative whole number of minutes.`,
      sessionId,
    });
  } else if (durationMin > 0 && tol >= durationMin) {
    errors.push({
      field: `${sessionId}.earlyDepartureToleranceMinutes`,
      message: `${label} early departure tolerance (${tol} min) must be less than session duration (${durationMin} min). Early threshold must be after session start.`,
      sessionId,
    });
  }

  // 4. Earliest Check-in Validation
  const earliestMin = timeToMinutes(session.earliestCheckinTime);
  if (isNaN(earliestMin)) {
    errors.push({
      field: `${sessionId}.earliestCheckinTime`,
      message: `${label} earliest check-in time is invalid.`,
      sessionId,
    });
  } else if (!isNaN(startMin) && earliestMin > startMin) {
    errors.push({
      field: `${sessionId}.earliestCheckinTime`,
      message: `${label} earliest check-in (${formatCivilTime(session.earliestCheckinTime)}) cannot be after expected start time (${formatCivilTime(session.startTime)}).`,
      sessionId,
    });
  }

  // 5. Latest Check-out Validation
  const latestMin = timeToMinutes(session.latestCheckoutTime);
  if (isNaN(latestMin)) {
    errors.push({
      field: `${sessionId}.latestCheckoutTime`,
      message: `${label} latest check-out time is invalid.`,
      sessionId,
    });
  } else if (!isNaN(endMin) && latestMin < endMin) {
    errors.push({
      field: `${sessionId}.latestCheckoutTime`,
      message: `${label} latest check-out (${formatCivilTime(session.latestCheckoutTime)}) cannot be before expected end time (${formatCivilTime(session.endTime)}).`,
      sessionId,
    });
  }

  // 6. Absence Cutoff Validation & Consistency
  const cutoffMin = timeToMinutes(session.absenceCutoffTime);
  const cutoffMinsParam = Number(session.absenceCutoffMinutes);

  if (isNaN(cutoffMin)) {
    errors.push({
      field: `${sessionId}.absenceCutoffTime`,
      message: `${label} absence cutoff time is invalid.`,
      sessionId,
    });
  } else if (!isNaN(startMin)) {
    if (cutoffMin <= startMin) {
      errors.push({
        field: `${sessionId}.absenceCutoffTime`,
        message: `${label} absence cutoff (${formatCivilTime(session.absenceCutoffTime)}) must occur after session start time (${formatCivilTime(session.startTime)}).`,
        sessionId,
      });
    } else if (!isNaN(endMin) && cutoffMin > endMin) {
      errors.push({
        field: `${sessionId}.absenceCutoffTime`,
        message: `${label} absence cutoff (${formatCivilTime(session.absenceCutoffTime)}) cannot be after session end time (${formatCivilTime(session.endTime)}).`,
        sessionId,
      });
    }
  }

  // Consistency between absenceCutoffTime and absenceCutoffMinutes
  if (!isNaN(startMin) && !isNaN(cutoffMin) && !isNaN(cutoffMinsParam) && cutoffMinsParam > 0) {
    const derivedCutoffMins = cutoffMin - startMin;
    if (Math.abs(derivedCutoffMins - cutoffMinsParam) > 1) {
      errors.push({
        field: `${sessionId}.absenceCutoffMinutes`,
        message: `${label} absence cutoff minutes (${cutoffMinsParam}m) does not match cutoff time (${formatCivilTime(session.absenceCutoffTime)} = +${derivedCutoffMins}m from start).`,
        sessionId,
      });
    }
  }

  return errors;
}

/**
 * Validates the combined Morning and Afternoon session schedule,
 * including cross-session overlap and chronological ordering.
 */
export function validateSessionSchedule(
  morning: Partial<StaffSessionConfig>,
  afternoon: Partial<StaffSessionConfig>
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate Morning individually
  errors.push(...validateSingleSession(morning, 'morning'));

  // Validate Afternoon individually
  errors.push(...validateSingleSession(afternoon, 'afternoon'));

  const mStart = timeToMinutes(morning.startTime);
  const mEnd = timeToMinutes(morning.endTime);
  const aStart = timeToMinutes(afternoon.startTime);
  const aEnd = timeToMinutes(afternoon.endTime);

  // 7. Cross-session Overlap & Ordering
  if (!isNaN(mStart) && !isNaN(mEnd) && !isNaN(aStart) && !isNaN(aEnd)) {
    if (aStart < mStart) {
      errors.push({
        field: 'sessions.order',
        message: `Morning session (${formatCivilTime(morning.startTime)} – ${formatCivilTime(morning.endTime)}) must precede Afternoon session (${formatCivilTime(afternoon.startTime)} – ${formatCivilTime(afternoon.endTime)}).`,
      });
    } else if (mEnd > aStart) {
      errors.push({
        field: 'sessions.overlap',
        message: `Morning session (ends at ${formatCivilTime(morning.endTime)}) overlaps with Afternoon session (starts at ${formatCivilTime(afternoon.startTime)}). Morning must end before or at Afternoon start.`,
      });
    }
  }

  const errorMap: Record<string, string> = {};
  for (const err of errors) {
    if (!errorMap[err.field]) {
      errorMap[err.field] = err.message;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMap,
  };
}

/**
 * Validates Daily working schedule settings.
 */
export function validateDailySchedule(settings: any): ValidationResult {
  const errors: ValidationError[] = [];

  const start = settings?.staffWorkStartTime || settings?.staff_work_start_time || '08:00';
  const end = settings?.staffWorkEndTime || settings?.staff_work_end_time || '17:00';
  const grace = Number(settings?.staffLateGraceMinutes ?? settings?.staff_late_grace_minutes ?? 15);
  const tol = Number(settings?.staffEarlyCheckoutToleranceMinutes ?? settings?.staff_early_checkout_tolerance_minutes ?? 15);
  const cutoffTime = settings?.staffAbsenceCutoffTime || settings?.staff_absence_cutoff_time || '10:00';
  const cutoffMins = Number(settings?.staffAbsenceCutoffMinutes ?? settings?.staff_absence_cutoff_minutes ?? 120);
  const earliest = settings?.staffEarliestCheckinTime || settings?.staff_earliest_checkin_time || '06:00';
  const latest = settings?.staffLatestCheckoutTime || settings?.staff_latest_checkout_time || '20:00';

  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  if (isNaN(startMin)) {
    errors.push({ field: 'daily.staffWorkStartTime', message: 'Daily work start time is invalid.', sessionId: 'daily' });
  }
  if (isNaN(endMin)) {
    errors.push({ field: 'daily.staffWorkEndTime', message: 'Daily work end time is invalid.', sessionId: 'daily' });
  }

  if (!isNaN(startMin) && !isNaN(endMin)) {
    if (startMin >= endMin) {
      errors.push({
        field: 'daily.staffWorkEndTime',
        message: `Daily work start time (${formatCivilTime(start)}) must be strictly before end time (${formatCivilTime(end)}). Overnight shifts are not supported.`,
        sessionId: 'daily',
      });
    }
  }

  const duration = !isNaN(startMin) && !isNaN(endMin) ? endMin - startMin : 0;

  if (isNaN(grace) || grace < 0 || !Number.isInteger(grace)) {
    errors.push({ field: 'daily.staffLateGraceMinutes', message: 'Late grace period must be a non-negative whole number.', sessionId: 'daily' });
  } else if (duration > 0 && grace >= duration) {
    errors.push({ field: 'daily.staffLateGraceMinutes', message: `Late grace period (${grace} min) must be less than working duration (${duration} min).`, sessionId: 'daily' });
  }

  if (isNaN(tol) || tol < 0 || !Number.isInteger(tol)) {
    errors.push({ field: 'daily.staffEarlyCheckoutToleranceMinutes', message: 'Early checkout tolerance must be a non-negative whole number.', sessionId: 'daily' });
  } else if (duration > 0 && tol >= duration) {
    errors.push({ field: 'daily.staffEarlyCheckoutToleranceMinutes', message: `Early checkout tolerance (${tol} min) must be less than working duration (${duration} min).`, sessionId: 'daily' });
  }

  const earliestMin = timeToMinutes(earliest);
  if (isNaN(earliestMin)) {
    errors.push({ field: 'daily.staffEarliestCheckinTime', message: 'Earliest check-in time is invalid.', sessionId: 'daily' });
  } else if (!isNaN(startMin) && earliestMin > startMin) {
    errors.push({ field: 'daily.staffEarliestCheckinTime', message: `Earliest check-in (${formatCivilTime(earliest)}) cannot be after work start time (${formatCivilTime(start)}).`, sessionId: 'daily' });
  }

  const latestMin = timeToMinutes(latest);
  if (isNaN(latestMin)) {
    errors.push({ field: 'daily.staffLatestCheckoutTime', message: 'Latest check-out time is invalid.', sessionId: 'daily' });
  } else if (!isNaN(endMin) && latestMin < endMin) {
    errors.push({ field: 'daily.staffLatestCheckoutTime', message: `Latest check-out (${formatCivilTime(latest)}) cannot be before work end time (${formatCivilTime(end)}).`, sessionId: 'daily' });
  }

  const cutoffMin = timeToMinutes(cutoffTime);
  if (isNaN(cutoffMin)) {
    errors.push({ field: 'daily.staffAbsenceCutoffTime', message: 'Absence cutoff time is invalid.', sessionId: 'daily' });
  } else if (!isNaN(startMin) && cutoffMin <= startMin) {
    errors.push({ field: 'daily.staffAbsenceCutoffTime', message: `Absence cutoff (${formatCivilTime(cutoffTime)}) must be after work start time (${formatCivilTime(start)}).`, sessionId: 'daily' });
  } else if (!isNaN(endMin) && cutoffMin > endMin) {
    errors.push({ field: 'daily.staffAbsenceCutoffTime', message: `Absence cutoff (${formatCivilTime(cutoffTime)}) cannot be after work end time (${formatCivilTime(end)}).`, sessionId: 'daily' });
  }

  const errorMap: Record<string, string> = {};
  for (const err of errors) {
    if (!errorMap[err.field]) {
      errorMap[err.field] = err.message;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMap,
  };
}

/**
 * Validates all schedule settings (both Session-based and Daily).
 */
export function validateAllScheduleSettings(settings: any, sessions?: StaffSessionConfig[]): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Validate Daily Schedule
  const dailyRes = validateDailySchedule(settings);
  errors.push(...dailyRes.errors);

  // 2. Validate Sessions if provided or in settings
  const rawSessions = sessions || settings?.staffSessions || settings?.staff_sessions;
  if (Array.isArray(rawSessions) && rawSessions.length >= 2) {
    const morning = rawSessions.find((s: any) => s.id === 'morning') || rawSessions[0];
    const afternoon = rawSessions.find((s: any) => s.id === 'afternoon') || rawSessions[1];
    const sessionRes = validateSessionSchedule(morning, afternoon);
    errors.push(...sessionRes.errors);
  }

  const errorMap: Record<string, string> = {};
  for (const err of errors) {
    if (!errorMap[err.field]) {
      errorMap[err.field] = err.message;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    errorMap,
  };
}
