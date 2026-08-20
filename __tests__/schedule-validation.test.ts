/**
 * Schedule & Session Configuration Validation Tests
 *
 * Verifies all 12 business validation rules for Morning, Afternoon, and Daily
 * staff attendance configurations to prevent saving logically impossible,
 * contradictory, or overlapping schedules.
 */

import {
  validateSingleSession,
  validateSessionSchedule,
  validateDailySchedule,
  validateAllScheduleSettings,
  timeToMinutes,
  addMinutesToHHMM,
  getMinutesDiff,
  StaffSessionConfig,
} from "../lib/utils/schedule-validation"

const VALID_MORNING: StaffSessionConfig = {
  id: "morning",
  name: "Morning",
  startTime: "08:00",
  endTime: "12:30",
  lateGraceMinutes: 15,
  earlyDepartureToleranceMinutes: 10,
  absenceCutoffMinutes: 90,
  absenceCutoffTime: "09:30",
  earliestCheckinTime: "06:00",
  latestCheckoutTime: "13:30",
  isActive: true,
}

const VALID_AFTERNOON: StaffSessionConfig = {
  id: "afternoon",
  name: "Afternoon",
  startTime: "13:30",
  endTime: "17:00",
  lateGraceMinutes: 10,
  earlyDepartureToleranceMinutes: 10,
  absenceCutoffMinutes: 90,
  absenceCutoffTime: "15:00",
  earliestCheckinTime: "12:30",
  latestCheckoutTime: "18:30",
  isActive: true,
}

describe("Schedule & Session Configuration Validation", () => {
  // ─── 1. Time Order: Expected Start < Expected End ──────────────────────────

  describe("1. Session Time Order (Start < End)", () => {
    test("Valid session with Start (08:00) < End (12:30) passes", () => {
      const errors = validateSingleSession(VALID_MORNING, "morning")
      expect(errors).toHaveLength(0)
    })

    test("Rejects session where Start == End (08:00 == 08:00)", () => {
      const session = { ...VALID_MORNING, startTime: "08:00", endTime: "08:00" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("endTime"))).toBe(true)
      expect(errors.some((e) => e.message.includes("strictly before end time"))).toBe(true)
    })

    test("Rejects inverted session where Start (12:30) > End (08:00)", () => {
      const session = { ...VALID_MORNING, startTime: "12:30", endTime: "08:00" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("endTime"))).toBe(true)
      expect(errors.some((e) => e.message.includes("Overnight sessions are not allowed"))).toBe(true)
    })
  })

  // ─── 2. Grace Period Validation ─────────────────────────────────────────────

  describe("2. Grace Period Validation", () => {
    test("Grace period of 15m in 08:00-12:30 session is valid", () => {
      const session = { ...VALID_MORNING, lateGraceMinutes: 15 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("lateGraceMinutes"))).toHaveLength(0)
    })

    test("Grace period of 0m (strict on-time) is valid", () => {
      const session = { ...VALID_MORNING, lateGraceMinutes: 0 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("lateGraceMinutes"))).toHaveLength(0)
    })

    test("Rejects negative grace period (-10m)", () => {
      const session = { ...VALID_MORNING, lateGraceMinutes: -10 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("lateGraceMinutes"))).toBe(true)
    })

    test("Rejects grace period exceeding session duration (e.g. 300m in 270m session)", () => {
      // 08:00 to 12:30 is 270 minutes
      const session = { ...VALID_MORNING, lateGraceMinutes: 300 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("lateGraceMinutes"))).toBe(true)
      expect(errors.some((e) => e.message.includes("Late threshold cannot exceed session end time"))).toBe(true)
    })
  })

  // ─── 3. Early Departure Tolerance Validation ────────────────────────────────

  describe("3. Early Departure Tolerance Validation", () => {
    test("Tolerance of 10m in 08:00-12:30 session is valid", () => {
      const session = { ...VALID_MORNING, earlyDepartureToleranceMinutes: 10 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("earlyDepartureToleranceMinutes"))).toHaveLength(0)
    })

    test("Rejects negative tolerance (-5m)", () => {
      const session = { ...VALID_MORNING, earlyDepartureToleranceMinutes: -5 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("earlyDepartureToleranceMinutes"))).toBe(true)
    })

    test("Rejects tolerance exceeding session duration (e.g. 300m in 270m session)", () => {
      const session = { ...VALID_MORNING, earlyDepartureToleranceMinutes: 300 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("earlyDepartureToleranceMinutes"))).toBe(true)
      expect(errors.some((e) => e.message.includes("Early threshold must be after session start"))).toBe(true)
    })
  })

  // ─── 4. Earliest Allowed Check-in Validation ────────────────────────────────

  describe("4. Earliest Allowed Check-in", () => {
    test("Earliest check-in (06:00) <= Start (08:00) is valid", () => {
      const session = { ...VALID_MORNING, earliestCheckinTime: "06:00", startTime: "08:00" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("earliestCheckinTime"))).toHaveLength(0)
    })

    test("Earliest check-in equal to Start (08:00 == 08:00) is valid", () => {
      const session = { ...VALID_MORNING, earliestCheckinTime: "08:00", startTime: "08:00" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("earliestCheckinTime"))).toHaveLength(0)
    })

    test("Rejects earliest check-in (09:00) after Start (08:00)", () => {
      const session = { ...VALID_MORNING, earliestCheckinTime: "09:00", startTime: "08:00" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("earliestCheckinTime"))).toBe(true)
      expect(errors.some((e) => e.message.includes("cannot be after expected start time"))).toBe(true)
    })
  })

  // ─── 5. Latest Allowed Check-out Validation ─────────────────────────────────

  describe("5. Latest Allowed Check-out", () => {
    test("Latest check-out (13:30) >= End (12:30) is valid", () => {
      const session = { ...VALID_MORNING, latestCheckoutTime: "13:30", endTime: "12:30" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("latestCheckoutTime"))).toHaveLength(0)
    })

    test("Latest check-out equal to End (12:30 == 12:30) is valid", () => {
      const session = { ...VALID_MORNING, latestCheckoutTime: "12:30", endTime: "12:30" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("latestCheckoutTime"))).toHaveLength(0)
    })

    test("Rejects latest check-out (11:00) before End (12:30)", () => {
      const session = { ...VALID_MORNING, latestCheckoutTime: "11:00", endTime: "12:30" }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("latestCheckoutTime"))).toBe(true)
      expect(errors.some((e) => e.message.includes("cannot be before expected end time"))).toBe(true)
    })
  })

  // ─── 6. Absence Cutoff Validation ───────────────────────────────────────────

  describe("6. Absence Cutoff Validation", () => {
    test("Absence cutoff (09:30) between Start (08:00) and End (12:30) is valid", () => {
      const session = { ...VALID_MORNING, absenceCutoffTime: "09:30", absenceCutoffMinutes: 90 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("absenceCutoff"))).toHaveLength(0)
    })

    test("Rejects absence cutoff (07:30) before Start (08:00)", () => {
      const session = { ...VALID_MORNING, absenceCutoffTime: "07:30", absenceCutoffMinutes: 90 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("absenceCutoffTime"))).toBe(true)
      expect(errors.some((e) => e.message.includes("must occur after session start time"))).toBe(true)
    })

    test("Rejects absence cutoff (13:00) after session End (12:30)", () => {
      const session = { ...VALID_MORNING, absenceCutoffTime: "13:00", absenceCutoffMinutes: 300 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("absenceCutoffTime"))).toBe(true)
      expect(errors.some((e) => e.message.includes("cannot be after session end time"))).toBe(true)
    })
  })

  // ─── 7. Absence Cutoff Consistency ──────────────────────────────────────────

  describe("7. Absence Cutoff Consistency (Time vs Minutes)", () => {
    test("Start 08:00 + Cutoff 09:30 + Minutes 90 is consistent", () => {
      const session = { ...VALID_MORNING, startTime: "08:00", absenceCutoffTime: "09:30", absenceCutoffMinutes: 90 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.filter((e) => e.field.includes("absenceCutoffMinutes"))).toHaveLength(0)
    })

    test("Rejects contradictory cutoff: Start 08:00, Cutoff 09:30 (90m), but Minutes parameter set to 180m", () => {
      const session = { ...VALID_MORNING, startTime: "08:00", absenceCutoffTime: "09:30", absenceCutoffMinutes: 180 }
      const errors = validateSingleSession(session, "morning")
      expect(errors.some((e) => e.field.includes("absenceCutoffMinutes"))).toBe(true)
      expect(errors.some((e) => e.message.includes("does not match cutoff time"))).toBe(true)
    })
  })

  // ─── 8. Session Overlap Validation ──────────────────────────────────────────

  describe("8. Session Overlap Validation (Morning vs Afternoon)", () => {
    test("Morning (08:00–12:30) and Afternoon (13:30–17:00) do NOT overlap (valid)", () => {
      const res = validateSessionSchedule(VALID_MORNING, VALID_AFTERNOON)
      expect(res.isValid).toBe(true)
      expect(res.errors).toHaveLength(0)
    })

    test("Morning (08:00–13:00) and Afternoon (13:00–17:00) touching at boundary is valid", () => {
      const morning = { ...VALID_MORNING, endTime: "13:00", absenceCutoffTime: "09:30", absenceCutoffMinutes: 90, latestCheckoutTime: "13:30" }
      const afternoon = { ...VALID_AFTERNOON, startTime: "13:00", absenceCutoffTime: "14:30", absenceCutoffMinutes: 90, earliestCheckinTime: "12:30" }
      const res = validateSessionSchedule(morning, afternoon)
      expect(res.isValid).toBe(true)
    })

    test("Rejects overlapping sessions: Morning (08:00–14:00) and Afternoon (13:30–17:00)", () => {
      const morning = { ...VALID_MORNING, endTime: "14:00", absenceCutoffTime: "09:30", absenceCutoffMinutes: 90, latestCheckoutTime: "14:30" }
      const res = validateSessionSchedule(morning, VALID_AFTERNOON)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.field === "sessions.overlap")).toBe(true)
      expect(res.errors.some((e) => e.message.includes("overlaps with Afternoon session"))).toBe(true)
    })
  })

  // ─── 9. Morning Must Precede Afternoon ──────────────────────────────────────

  describe("9. Chronological Order (Morning precedes Afternoon)", () => {
    test("Rejects inverted schedule: Afternoon starts at 08:00 and Morning starts at 13:30", () => {
      const morning = { ...VALID_MORNING, startTime: "13:30", endTime: "17:00", absenceCutoffTime: "15:00", absenceCutoffMinutes: 90, earliestCheckinTime: "12:30", latestCheckoutTime: "18:00" }
      const afternoon = { ...VALID_AFTERNOON, startTime: "08:00", endTime: "12:30", absenceCutoffTime: "09:30", absenceCutoffMinutes: 90, earliestCheckinTime: "06:00", latestCheckoutTime: "13:30" }
      const res = validateSessionSchedule(morning, afternoon)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.field === "sessions.order")).toBe(true)
      expect(res.errors.some((e) => e.message.includes("must precede Afternoon session"))).toBe(true)
    })
  })

  // ─── 10. Canonical Time & Helper Functions ──────────────────────────────────

  describe("10. Time Helpers (timeToMinutes, addMinutesToHHMM, getMinutesDiff)", () => {
    test("timeToMinutes converts 00:00 to 0 and 23:59 to 1439", () => {
      expect(timeToMinutes("00:00")).toBe(0)
      expect(timeToMinutes("08:30")).toBe(510)
      expect(timeToMinutes("12:00")).toBe(720)
      expect(timeToMinutes("23:59")).toBe(1439)
      expect(isNaN(timeToMinutes("invalid"))).toBe(true)
    })

    test("addMinutesToHHMM handles positive and negative offsets", () => {
      expect(addMinutesToHHMM("08:00", 15)).toBe("08:15")
      expect(addMinutesToHHMM("12:30", -15)).toBe("12:15")
      expect(addMinutesToHHMM("17:00", 90)).toBe("18:30")
    })

    test("getMinutesDiff returns correct signed difference", () => {
      expect(getMinutesDiff("09:30", "08:00")).toBe(90)
      expect(getMinutesDiff("08:00", "09:30")).toBe(-90)
    })
  })

  // ─── 11. Daily Mode Schedule Validation ─────────────────────────────────────

  describe("11. Daily Schedule Validation", () => {
    test("Valid daily schedule passes", () => {
      const settings = {
        staffWorkStartTime: "08:00",
        staffWorkEndTime: "17:00",
        staffLateGraceMinutes: 15,
        staffEarlyCheckoutToleranceMinutes: 15,
        staffAbsenceCutoffTime: "10:00",
        staffAbsenceCutoffMinutes: 120,
        staffEarliestCheckinTime: "06:00",
        staffLatestCheckoutTime: "20:00",
      }
      const res = validateDailySchedule(settings)
      expect(res.isValid).toBe(true)
      expect(res.errors).toHaveLength(0)
    })

    test("Rejects daily schedule with start >= end", () => {
      const settings = {
        staffWorkStartTime: "17:00",
        staffWorkEndTime: "08:00",
      }
      const res = validateDailySchedule(settings)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.field === "daily.staffWorkEndTime")).toBe(true)
    })

    test("Rejects daily schedule where earliest check-in is after start", () => {
      const settings = {
        staffWorkStartTime: "08:00",
        staffWorkEndTime: "17:00",
        staffEarliestCheckinTime: "09:00",
      }
      const res = validateDailySchedule(settings)
      expect(res.isValid).toBe(false)
      expect(res.errors.some((e) => e.field === "daily.staffEarliestCheckinTime")).toBe(true)
    })
  })

  // ─── 12. Combined validateAllScheduleSettings ───────────────────────────────

  describe("12. validateAllScheduleSettings (Combined Suite)", () => {
    test("Valid combined settings return isValid === true", () => {
      const settings = {
        staffAttendanceMode: "session_based",
        staffWorkStartTime: "08:00",
        staffWorkEndTime: "17:00",
        staffLateGraceMinutes: 15,
        staffEarlyCheckoutToleranceMinutes: 15,
        staffAbsenceCutoffTime: "10:00",
        staffAbsenceCutoffMinutes: 120,
        staffEarliestCheckinTime: "06:00",
        staffLatestCheckoutTime: "20:00",
        staffSessions: [VALID_MORNING, VALID_AFTERNOON],
      }
      const res = validateAllScheduleSettings(settings)
      expect(res.isValid).toBe(true)
      expect(res.errors).toHaveLength(0)
    })
  })
})
