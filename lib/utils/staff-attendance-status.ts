/**
 * Utility functions for deriving and presenting Check-In and Check-Out statuses
 * independently for Staff Attendance without overwriting check-in status on checkout.
 */

export interface StaffStatusDisplay {
  status: string // "NOT_STARTED" | "PENDING" | "LATE" | "PRESENT" | "ON_TIME" | "EARLY_LEAVE" | "NOT_CHECKED_IN" | "NOT_CHECKED_OUT" | "ABSENT" | "LEAVE" | "PERMISSION"
  label: string // e.g. "NOT STARTED", "PENDING CHECK-IN", "LATE", "ON TIME", "EARLY LEAVE", "ABSENT", "ON LEAVE"
  titleLabel: string // e.g. "Not Started", "Pending Check-In", "Late (15 min)", "On Time", "Absent", "On Leave"
  timeStr: string // e.g. "11:09" or "—"
  fullDateTimeStr?: string
  hasTime: boolean
  latenessMinutes?: number
  latenessFormatted?: string
  badgeColor: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  dotColor: string
}

export interface StaffAttendanceDisplay {
  checkIn: StaffStatusDisplay
  checkOut: StaffStatusDisplay
  overallStatus: string
  isComplete: boolean
  faceVerified: boolean
  geofenceVerified: boolean
  latenessMinutes?: number
  latenessFormatted?: string
}

/**
 * Add or subtract minutes from an "HH:MM" string.
 */
export function addMinutesToHHMM(timeHHMM: string, minutes: number): string {
  if (!timeHHMM || !timeHHMM.includes(":")) return "08:00"
  const [h, m] = timeHHMM.split(":").map(Number)
  let totalMin = (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m) + minutes
  if (totalMin < 0) totalMin = 0
  if (totalMin >= 24 * 60) totalMin = 24 * 60 - 1
  const newH = Math.floor(totalMin / 60)
  const newM = totalMin % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

/**
 * Calculate difference in minutes between two "HH:MM" times (timeA - timeB).
 */
export function getMinutesDiff(timeA: string, timeB: string): number {
  if (!timeA || !timeB || !timeA.includes(":") || !timeB.includes(":")) return 0
  const [hA, mA] = timeA.split(":").map(Number)
  const [hB, mB] = timeB.split(":").map(Number)
  return (hA * 60 + mA) - (hB * 60 + mB)
}

/**
 * Check if timeA (HH:MM) is after timeB (HH:MM).
 */
export function isHHMMAfter(timeA: string, timeB: string): boolean {
  if (!timeA || !timeB) return false
  const [hA, mA] = timeA.split(":").map(Number)
  const [hB, mB] = timeB.split(":").map(Number)
  if (hA > hB) return true
  if (hA === hB && mA > mB) return true
  return false
}

/**
 * Check if timeA (HH:MM) is before timeB (HH:MM).
 */
export function isHHMMBefore(timeA: string, timeB: string): boolean {
  if (!timeA || !timeB) return false
  const [hA, mA] = timeA.split(":").map(Number)
  const [hB, mB] = timeB.split(":").map(Number)
  if (hA < hB) return true
  if (hA === hB && mA < mB) return true
  return false
}

/**
 * Extracts HH:MM in 24-hour format from a Date or ISO string.
 */
export function getHHMMFromDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return ""
  try {
    const d = typeof dateInput === "number" || typeof dateInput === "string" ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return ""
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Addis_Ababa",
    })
  } catch {
    return ""
  }
}

import { formatEthiopianTime, formatCivilTime, formatCivilFullDateTime } from "@/lib/utils/ethiopian-time"

/**
 * Formats a Date or ISO string into Ethiopian Clock format (e.g. "2:15 Ethiopian").
 * Strictly in Africa/Addis_Ababa timezone without device-clock dependence.
 */
export function formatAttendanceTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "—"
  return formatEthiopianTime(dateInput)
}

/**
 * Formats a Date or ISO string into a full datetime string in Africa/Addis_Ababa timezone.
 * Displays date + 12-hour AM/PM time. Used for fullDateTimeStr tooltip/title attributes.
 * Example: "Aug 20, 2026 • 8:30 AM"
 */
function formatFullDateTimeET(dateInput?: string | Date | null): string | undefined {
  if (!dateInput) return undefined
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return undefined
    return formatCivilFullDateTime(d)
  } catch {
    return undefined
  }
}

/**
 * Derives Check-In status details from record & schedule settings.
 * Strictly adheres to the lifecycle:
 * Not Started → Pending Check-In → Present / Late → Absent (with Leave exceptions)
 */
export function getStaffCheckInStatus(
  record?: any,
  settings?: any,
  sessionConfig?: any
): StaffStatusDisplay {
  const hasCheckIn = !!record?.checkInTime
  const checkInTimeStr = hasCheckIn ? formatAttendanceTime(record.checkInTime) : "—"
  const rawStatus = (record?.status || "").toUpperCase()

  // 1. Resolve schedule threshold parameters
  const expectedStartTime = sessionConfig?.startTime || settings?.staffWorkStartTime || settings?.staff_work_start_time || "08:00"
  const graceMinutes = sessionConfig?.lateGraceMinutes ?? settings?.staffLateGraceMinutes ?? settings?.staff_late_grace_minutes ?? 15
  const lateCutoff = sessionConfig?.startTime
    ? addMinutesToHHMM(sessionConfig.startTime, graceMinutes)
    : settings?.staffCheckinLate || settings?.staff_checkin_late || addMinutesToHHMM(expectedStartTime, graceMinutes)

  const absenceCutoffMinutes = sessionConfig?.absenceCutoffMinutes ?? settings?.staffAbsenceCutoffMinutes ?? settings?.staff_absence_cutoff_minutes ?? 120
  const absenceCutoff = sessionConfig?.absenceCutoffTime || settings?.staffAbsenceCutoffTime || settings?.staff_absence_cutoff_time || addMinutesToHHMM(expectedStartTime, absenceCutoffMinutes)

  // Current time in Africa/Addis_Ababa
  const now = new Date()
  const currentTimeHHMM = now.toLocaleTimeString("en-US", {
    timeZone: "Africa/Addis_Ababa",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  })

  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" })
  const recordDateStr = record?.date ? record.date.split("T")[0] : todayStr
  const isToday = recordDateStr === todayStr

  // 2. Not checked in yet
  if (!hasCheckIn) {
    if (rawStatus === "LEAVE") {
      return {
        status: "LEAVE",
        label: "ON LEAVE",
        titleLabel: "On Leave",
        timeStr: "—",
        hasTime: false,
        badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
        badgeBg: "bg-blue-500/15",
        badgeText: "text-blue-700 dark:text-blue-300",
        badgeBorder: "border-blue-500/30",
        dotColor: "bg-blue-500",
      }
    }
    if (rawStatus === "PERMISSION") {
      return {
        status: "PERMISSION",
        label: "PERMISSION",
        titleLabel: "Permission",
        timeStr: "—",
        hasTime: false,
        badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
        badgeBg: "bg-purple-500/15",
        badgeText: "text-purple-700 dark:text-purple-300",
        badgeBorder: "border-purple-500/30",
        dotColor: "bg-purple-500",
      }
    }
    if (rawStatus === "ABSENT") {
      return {
        status: "ABSENT",
        label: "ABSENT",
        titleLabel: "Absent",
        timeStr: "—",
        hasTime: false,
        badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        badgeBg: "bg-rose-500/15",
        badgeText: "text-rose-700 dark:text-rose-300",
        badgeBorder: "border-rose-500/30",
        dotColor: "bg-rose-500",
      }
    }

    // Lifecycle check when unrecorded:
    if (isToday) {
      if (isHHMMBefore(currentTimeHHMM, expectedStartTime)) {
        return {
          status: "NOT_STARTED",
          label: "NOT STARTED",
          titleLabel: "Not Started",
          timeStr: "—",
          hasTime: false,
          badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          badgeBg: "bg-slate-500/10",
          badgeText: "text-slate-600 dark:text-slate-400",
          badgeBorder: "border-slate-500/20",
          dotColor: "bg-slate-400",
        }
      }

      if (isHHMMBefore(currentTimeHHMM, absenceCutoff)) {
        return {
          status: "PENDING",
          label: "PENDING CHECK-IN",
          titleLabel: "Pending Check-In",
          timeStr: "—",
          hasTime: false,
          badgeColor: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
          badgeBg: "bg-sky-500/15",
          badgeText: "text-sky-700 dark:text-sky-300",
          badgeBorder: "border-sky-500/30",
          dotColor: "bg-sky-500",
        }
      }

      // Cutoff has passed on today without check-in
      return {
        status: "ABSENT",
        label: "ABSENT",
        titleLabel: "Absent",
        timeStr: "—",
        hasTime: false,
        badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
        badgeBg: "bg-rose-500/15",
        badgeText: "text-rose-700 dark:text-rose-300",
        badgeBorder: "border-rose-500/30",
        dotColor: "bg-rose-500",
      }
    }

    // Past date with no check-in -> Absent
    return {
      status: "ABSENT",
      label: "ABSENT",
      titleLabel: "Absent",
      timeStr: "—",
      hasTime: false,
      badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
      badgeBg: "bg-rose-500/15",
      badgeText: "text-rose-700 dark:text-rose-300",
      badgeBorder: "border-rose-500/30",
      dotColor: "bg-rose-500",
    }
  }

  // 3. Has check-in time -> evaluate if Late or On Time
  let isLate = rawStatus === "LATE"
  const checkInHHMM = getHHMMFromDate(record.checkInTime)

  if (!isLate && (rawStatus === "EARLY_DEPARTURE" || rawStatus === "EARLY_LEAVE" || rawStatus === "PRESENT" || !rawStatus)) {
    if (checkInHHMM && lateCutoff && isHHMMAfter(checkInHHMM, lateCutoff)) {
      isLate = true
    }
  }

  if (isLate) {
    const latenessMins = Math.max(0, getMinutesDiff(checkInHHMM, expectedStartTime))
    const formattedLateness = latenessMins > 0
      ? (latenessMins >= 60 ? `${Math.floor(latenessMins / 60)}h ${latenessMins % 60}m late` : `${latenessMins}m late`)
      : undefined

    return {
      status: "LATE",
      label: "LATE",
      titleLabel: latenessMins > 0 ? `Late (${latenessMins} min)` : "Late",
      timeStr: checkInTimeStr,
      fullDateTimeStr: formatFullDateTimeET(record.checkInTime),
      hasTime: true,
      latenessMinutes: latenessMins,
      latenessFormatted: formattedLateness,
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      badgeBg: "bg-amber-500/15",
      badgeText: "text-amber-700 dark:text-amber-300",
      badgeBorder: "border-amber-500/30",
      dotColor: "bg-amber-500",
    }
  }

  return {
    status: "ON_TIME",
    label: "ON TIME",
    titleLabel: "On Time",
    timeStr: checkInTimeStr,
    fullDateTimeStr: formatFullDateTimeET(record.checkInTime),
    hasTime: true,
    badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    dotColor: "bg-emerald-500",
  }
}

/**
 * Derives Check-Out status details from record & schedule settings.
 */
export function getStaffCheckOutStatus(
  record?: any,
  settings?: any,
  sessionConfig?: any
): StaffStatusDisplay {
  const hasCheckOut = !!record?.checkOutTime
  const hasCheckIn = !!record?.checkInTime
  const checkOutTimeStr = hasCheckOut ? formatAttendanceTime(record.checkOutTime) : "—"
  const rawStatus = (record?.status || "").toUpperCase()

  // 1. Not checked out yet
  if (!hasCheckOut) {
    if (!hasCheckIn) {
      if (rawStatus === "ABSENT") {
        return {
          status: "ABSENT",
          label: "ABSENT",
          titleLabel: "Absent",
          timeStr: "—",
          hasTime: false,
          badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
          badgeBg: "bg-rose-500/15",
          badgeText: "text-rose-700 dark:text-rose-300",
          badgeBorder: "border-rose-500/30",
          dotColor: "bg-rose-500",
        }
      }
      if (rawStatus === "LEAVE") {
        return {
          status: "LEAVE",
          label: "ON LEAVE",
          titleLabel: "On Leave",
          timeStr: "—",
          hasTime: false,
          badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
          badgeBg: "bg-blue-500/15",
          badgeText: "text-blue-700 dark:text-blue-300",
          badgeBorder: "border-blue-500/30",
          dotColor: "bg-blue-500",
        }
      }
      if (rawStatus === "PERMISSION") {
        return {
          status: "PERMISSION",
          label: "PERMISSION",
          titleLabel: "Permission",
          timeStr: "—",
          hasTime: false,
          badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
          badgeBg: "bg-purple-500/15",
          badgeText: "text-purple-700 dark:text-purple-300",
          badgeBorder: "border-purple-500/30",
          dotColor: "bg-purple-500",
        }
      }
    }

    return {
      status: "NOT_CHECKED_OUT",
      label: "NOT CHECKED OUT",
      titleLabel: "Not Checked Out",
      timeStr: "—",
      hasTime: false,
      badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      badgeBg: "bg-slate-500/10",
      badgeText: "text-slate-600 dark:text-slate-400",
      badgeBorder: "border-slate-500/20",
      dotColor: "bg-slate-400",
    }
  }

  // 2. Has check-out time -> evaluate if Early Leave or On Time
  let isEarlyLeave =
    rawStatus === "EARLY_DEPARTURE" ||
    rawStatus === "EARLY_LEAVE" ||
    rawStatus === "EARLY LEAVE"

  if (!isEarlyLeave) {
    const checkOutHHMM = getHHMMFromDate(record.checkOutTime)
    let earlyCutoff = "16:45"

    if (sessionConfig?.endTime) {
      earlyCutoff = addMinutesToHHMM(
        sessionConfig.endTime,
        -(sessionConfig.earlyDepartureToleranceMinutes ?? 10)
      )
    } else if (settings) {
      const endTime = settings.staffWorkEndTime || settings.staff_work_end_time || "17:00"
      const tol = settings.staffEarlyCheckoutToleranceMinutes ?? settings.staff_early_checkout_tolerance_minutes ?? 15
      earlyCutoff = settings.staffCheckoutEarly || settings.staff_checkout_early || addMinutesToHHMM(endTime, -tol)
    }

    if (checkOutHHMM && earlyCutoff && isHHMMBefore(checkOutHHMM, earlyCutoff)) {
      isEarlyLeave = true
    }
  }

  if (isEarlyLeave) {
    return {
      status: "EARLY_LEAVE",
      label: "EARLY LEAVE",
      titleLabel: "Early Leave",
      timeStr: checkOutTimeStr,
      fullDateTimeStr: formatFullDateTimeET(record.checkOutTime),
      hasTime: true,
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
      badgeBg: "bg-amber-500/15",
      badgeText: "text-amber-700 dark:text-amber-300",
      badgeBorder: "border-amber-500/30",
      dotColor: "bg-amber-500",
    }
  }

  return {
    status: "ON_TIME",
    label: "ON TIME",
    titleLabel: "On Time",
    timeStr: checkOutTimeStr,
    fullDateTimeStr: formatFullDateTimeET(record.checkOutTime),
    hasTime: true,
    badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    dotColor: "bg-emerald-500",
  }
}

/**
 * Returns combined check-in and check-out displays for a staff attendance record.
 */
export function getStaffAttendanceDisplay(
  record?: any,
  settings?: any,
  sessionConfig?: any
): StaffAttendanceDisplay {
  const checkIn = getStaffCheckInStatus(record, settings, sessionConfig)
  const checkOut = getStaffCheckOutStatus(record, settings, sessionConfig)

  return {
    checkIn,
    checkOut,
    overallStatus: record?.status || "NOT_RECORDED",
    isComplete: !!(record?.checkInTime && record?.checkOutTime),
    faceVerified: !!record?.faceVerified,
    geofenceVerified: !!record?.geofenceVerified,
    latenessMinutes: checkIn.latenessMinutes,
    latenessFormatted: checkIn.latenessFormatted,
  }
}

export interface CheckInButtonState {
  canCheckIn: boolean
  isBeforeEarliest: boolean
  isAfterCutoff: boolean
  buttonText: string
  helperText?: string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
}

/**
 * Computes whether the staff check-in button is active or inactive,
 * respecting earliestCheckinTime and absenceCutoffTime gates.
 */
export function getCheckInButtonState(
  record?: any,
  settings?: any,
  sessionConfig?: any,
  dateInput?: Date | string | number | null
): CheckInButtonState {
  // 1. If already checked in for this session/day
  if (record && record.checkInTime) {
    return {
      canCheckIn: false,
      isBeforeEarliest: false,
      isAfterCutoff: false,
      buttonText: "Already Checked In",
      helperText: "Check-in recorded for today",
    }
  }

  // Get current time in Africa/Addis_Ababa
  let currentTimeHHMM: string
  if (dateInput) {
    currentTimeHHMM = getHHMMFromDate(dateInput)
  } else {
    currentTimeHHMM = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Addis_Ababa",
    })
  }

  let earliestCheckIn = "06:00"
  let absenceCutoffTime = "10:00"
  let allowCheckinAfterCutoff = false

  if (sessionConfig) {
    earliestCheckIn = sessionConfig.earliestCheckinTime || sessionConfig.earliestCheckInTime || addMinutesToHHMM(sessionConfig.startTime || "08:00", -60)
    const absenceMins = sessionConfig.absenceCutoffMinutes ?? 90
    absenceCutoffTime = sessionConfig.absenceCutoffTime || addMinutesToHHMM(sessionConfig.startTime || "08:00", absenceMins)
    allowCheckinAfterCutoff = sessionConfig.allowCheckinAfterCutoff ?? settings?.allowStaffCheckinAfterCutoff ?? settings?.allow_staff_checkin_after_cutoff ?? false
  } else if (settings) {
    earliestCheckIn = settings.staffEarliestCheckinTime || settings.staff_earliest_checkin_time || "06:00"
    const start = settings.staffWorkStartTime || settings.staff_work_start_time || "08:00"
    const mins = settings.staffAbsenceCutoffMinutes ?? settings.staff_absence_cutoff_minutes ?? 120
    absenceCutoffTime = settings.staffAbsenceCutoffTime || settings.staff_absence_cutoff_time || addMinutesToHHMM(start, mins)
    allowCheckinAfterCutoff = settings.allowStaffCheckinAfterCutoff ?? settings.allow_staff_checkin_after_cutoff ?? false
  }

  // 2. Gate 1: Before Earliest Check-In Time
  if (earliestCheckIn && isHHMMBefore(currentTimeHHMM, earliestCheckIn)) {
    return {
      canCheckIn: false,
      isBeforeEarliest: true,
      isAfterCutoff: false,
      buttonText: `Check-In Opens at ${formatCivilTime(earliestCheckIn)}`,
      helperText: `Check-in opens at ${formatCivilTime(earliestCheckIn)}. Current time: ${formatCivilTime(currentTimeHHMM)}.`,
      badgeVariant: "secondary",
    }
  }

  // 3. Gate 2: After Absence Cutoff Time when post-cutoff check-in is disallowed
  if (!allowCheckinAfterCutoff && absenceCutoffTime && isHHMMAfter(currentTimeHHMM, absenceCutoffTime)) {
    return {
      canCheckIn: false,
      isBeforeEarliest: false,
      isAfterCutoff: true,
      buttonText: "Check-In Closed",
      helperText: `Absence cutoff elapsed at ${formatCivilTime(absenceCutoffTime)}. Check-in is closed.`,
      badgeVariant: "destructive",
    }
  }

  // 4. Check-In is Open
  return {
    canCheckIn: true,
    isBeforeEarliest: false,
    isAfterCutoff: false,
    buttonText: "Check In Now",
    helperText: `Check-in window open until ${formatCivilTime(absenceCutoffTime)}`,
    badgeVariant: "default",
  }
}
