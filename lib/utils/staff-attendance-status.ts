/**
 * Utility functions for deriving and presenting Check-In and Check-Out statuses
 * independently for Staff Attendance without overwriting check-in status on checkout.
 */

export interface StaffStatusDisplay {
  status: string // "LATE" | "PRESENT" | "ON_TIME" | "EARLY_LEAVE" | "NOT_CHECKED_IN" | "NOT_CHECKED_OUT" | "ABSENT" | "LEAVE" | "PERMISSION"
  label: string // e.g. "LATE", "ON TIME", "EARLY LEAVE", "NOT CHECKED IN", "NOT CHECKED OUT"
  titleLabel: string // e.g. "Late", "On Time", "Early Leave", "Not Checked In", "Not Checked Out"
  timeStr: string // e.g. "11:09" or "—"
  fullDateTimeStr?: string
  hasTime: boolean
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
export function getHHMMFromDate(dateInput?: string | Date | null): string {
  if (!dateInput) return ""
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
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

/**
 * Formats a Date or ISO string into localized "HH:MM" (12h or 24h as per system).
 */
export function formatAttendanceTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "—"
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
}

/**
 * Derives Check-In status details from record & schedule settings.
 */
export function getStaffCheckInStatus(
  record?: any,
  settings?: any,
  sessionConfig?: any
): StaffStatusDisplay {
  const hasCheckIn = !!record?.checkInTime
  const checkInTimeStr = hasCheckIn ? formatAttendanceTime(record.checkInTime) : "—"
  const rawStatus = (record?.status || "").toUpperCase()

  // 1. Not checked in yet
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
    return {
      status: "NOT_CHECKED_IN",
      label: "NOT CHECKED IN",
      titleLabel: "Not Checked In",
      timeStr: "—",
      hasTime: false,
      badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      badgeBg: "bg-slate-500/10",
      badgeText: "text-slate-600 dark:text-slate-400",
      badgeBorder: "border-slate-500/20",
      dotColor: "bg-slate-400",
    }
  }

  // 2. Has check-in time -> evaluate if Late or On Time
  let isLate = rawStatus === "LATE"

  if (!isLate && (rawStatus === "EARLY_DEPARTURE" || rawStatus === "EARLY_LEAVE" || rawStatus === "PRESENT")) {
    // Check against schedule cutoff
    const checkInHHMM = getHHMMFromDate(record.checkInTime)
    let lateCutoff = "08:15"

    if (sessionConfig?.startTime) {
      lateCutoff = addMinutesToHHMM(sessionConfig.startTime, sessionConfig.lateGraceMinutes ?? 15)
    } else if (settings) {
      const startTime = settings.staffWorkStartTime || settings.staff_work_start_time || "08:00"
      const grace = settings.staffLateGraceMinutes ?? settings.staff_late_grace_minutes ?? 15
      lateCutoff = settings.staffCheckinLate || settings.staff_checkin_late || addMinutesToHHMM(startTime, grace)
    }

    if (checkInHHMM && lateCutoff && isHHMMAfter(checkInHHMM, lateCutoff)) {
      isLate = true
    }
  }

  if (isLate) {
    return {
      status: "LATE",
      label: "LATE",
      titleLabel: "Late",
      timeStr: checkInTimeStr,
      fullDateTimeStr: record.checkInTime ? new Date(record.checkInTime).toLocaleString() : undefined,
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
    timeStr: checkInTimeStr,
    fullDateTimeStr: record.checkInTime ? new Date(record.checkInTime).toLocaleString() : undefined,
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
      fullDateTimeStr: record.checkOutTime ? new Date(record.checkOutTime).toLocaleString() : undefined,
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
    fullDateTimeStr: record.checkOutTime ? new Date(record.checkOutTime).toLocaleString() : undefined,
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
  }
}
