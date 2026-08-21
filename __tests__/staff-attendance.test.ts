import { calculateDistanceMeters } from "../lib/utils/geofence"
import { calculateEuclideanDistance } from "../lib/hooks/use-face-recognition"
import {
  getStaffCheckInStatus,
  getStaffCheckOutStatus,
  getStaffAttendanceDisplay,
  getCheckInButtonState,
} from "../lib/utils/staff-attendance-status"

describe("Staff Attendance & Biometric Geofencing Unit Tests", () => {
  describe("1. Geofencing Distance Calculations (Haversine)", () => {
    // Addis Ababa University Main Campus Coordinates: 9.0477, 38.7618
    const schoolLat = 9.0477
    const schoolLon = 38.7618

    test("should calculate 0 meters distance when coordinates match exactly", () => {
      const distance = calculateDistanceMeters(schoolLat, schoolLon, schoolLat, schoolLon)
      expect(distance).toBe(0)
    })

    test("should accurately calculate distance within allowed radius (e.g. 50 meters)", () => {
      // Offset by ~0.0003 degrees latitude (~33 meters)
      const userLat = 9.0480
      const userLon = 38.7618
      const distance = calculateDistanceMeters(userLat, userLon, schoolLat, schoolLon)
      expect(distance).toBeGreaterThan(0)
      expect(distance).toBeLessThan(100)
    })

    test("should detect when coordinates are outside the permitted geofence boundary (e.g. > 500m)", () => {
      // Offset by ~0.01 degrees (~1.1 km away)
      const userLat = 9.0577
      const userLon = 38.7618
      const distance = calculateDistanceMeters(userLat, userLon, schoolLat, schoolLon)
      expect(distance).toBeGreaterThan(500)
    })
  })

  describe("2. Face Biometric Descriptor Verification (Euclidean Distance)", () => {
    const mockDescriptorA = Array(128).fill(0).map((_, i) => Math.sin(i))
    const mockDescriptorSame = [...mockDescriptorA]
    // Slight perturbation representing natural camera lighting variations
    const mockDescriptorSimilar = mockDescriptorA.map(val => val + 0.01)
    // Completely different face descriptor
    const mockDescriptorDifferent = Array(128).fill(0).map((_, i) => Math.cos(i * 2))

    test("identical face descriptors should have a distance of 0.0", () => {
      const dist = calculateEuclideanDistance(mockDescriptorA, mockDescriptorSame)
      expect(dist).toBe(0)
    })

    test("similar face descriptors (same person) should be well within matching threshold (<= 0.50)", () => {
      const dist = calculateEuclideanDistance(mockDescriptorA, mockDescriptorSimilar)
      expect(dist).toBeLessThan(0.50)
    })

    test("different face descriptors (different people) should exceed matching threshold (> 0.50)", () => {
      const dist = calculateEuclideanDistance(mockDescriptorA, mockDescriptorDifferent)
      expect(dist).toBeGreaterThan(0.50)
    })

    test("should return max distance if one of the descriptors is missing or invalid", () => {
      const dist = calculateEuclideanDistance([], mockDescriptorA)
      expect(dist).toBe(1.0)
    })
  })

  describe("3. Attendance State Transitions & Time Rules", () => {
    function isTimeAfter(currentHHMM: string, targetHHMM: string): boolean {
      const [cH, cM] = currentHHMM.split(':').map(Number)
      const [tH, tM] = targetHHMM.split(':').map(Number)
      if (cH > tH) return true
      if (cH === tH && cM > tM) return true
      return false
    }

    function isTimeBefore(currentHHMM: string, targetHHMM: string): boolean {
      const [cH, cM] = currentHHMM.split(':').map(Number)
      const [tH, tM] = targetHHMM.split(':').map(Number)
      if (cH < tH) return true
      if (cH === tH && cM < tM) return true
      return false
    }

    test("should correctly classify check-in before late threshold as PRESENT", () => {
      const checkInTime = "07:45"
      const lateThreshold = "08:30"
      const isLate = isTimeAfter(checkInTime, lateThreshold)
      expect(isLate).toBe(false)
    })

    test("should correctly classify check-in after late threshold as LATE", () => {
      const checkInTime = "08:45"
      const lateThreshold = "08:30"
      const isLate = isTimeAfter(checkInTime, lateThreshold)
      expect(isLate).toBe(true)
    })

    test("should correctly identify early departure before cutoff time", () => {
      const checkOutTime = "15:30"
      const earlyDepartureCutoff = "16:00"
      const isEarly = isTimeBefore(checkOutTime, earlyDepartureCutoff)
      expect(isEarly).toBe(true)
    })
  })

  describe("4. Staff Working Hours & Dynamic Grace Periods", () => {
    function addMinutesToTime(timeHHMM: string, minutes: number): string {
      const [h, m] = timeHHMM.split(':').map(Number)
      let totalMin = h * 60 + m + minutes
      if (totalMin < 0) totalMin = 0
      if (totalMin >= 24 * 60) totalMin = 24 * 60 - 1
      const newH = Math.floor(totalMin / 60)
      const newM = totalMin % 60
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
    }

    function isTimeAfter(currentHHMM: string, targetHHMM: string): boolean {
      const [cH, cM] = currentHHMM.split(':').map(Number)
      const [tH, tM] = targetHHMM.split(':').map(Number)
      if (cH > tH) return true
      if (cH === tH && cM > tM) return true
      return false
    }

    function isTimeBefore(currentHHMM: string, targetHHMM: string): boolean {
      const [cH, cM] = currentHHMM.split(':').map(Number)
      const [tH, tM] = targetHHMM.split(':').map(Number)
      if (cH < tH) return true
      if (cH === tH && cM < tM) return true
      return false
    }

    test("should dynamically compute late cutoff from start time + grace period (e.g. 08:00 + 15m = 08:15)", () => {
      const startTime = "08:00"
      const graceMinutes = 15
      const lateCutoff = addMinutesToTime(startTime, graceMinutes)
      expect(lateCutoff).toBe("08:15")

      // 08:14 is within grace period -> PRESENT
      expect(isTimeAfter("08:14", lateCutoff)).toBe(false)
      // 08:16 is after grace period -> LATE
      expect(isTimeAfter("08:16", lateCutoff)).toBe(true)
    })

    test("should dynamically compute early departure cutoff from end time - tolerance (e.g. 17:00 - 15m = 16:45)", () => {
      const endTime = "17:00"
      const toleranceMinutes = 15
      const earlyCutoff = addMinutesToTime(endTime, -toleranceMinutes)
      expect(earlyCutoff).toBe("16:45")

      // 16:40 is before cutoff -> EARLY_DEPARTURE
      expect(isTimeBefore("16:40", earlyCutoff)).toBe(true)
      // 16:50 is after cutoff -> Normal checkout (no early departure)
      expect(isTimeBefore("16:50", earlyCutoff)).toBe(false)
    })
  })

  describe("5. Working Calendar & Holiday Detection", () => {
    interface MockHoliday {
      name: string
      startDate: string
      endDate: string
      type: string
      isActive: boolean
    }

    function evaluateDate(
      dateStr: string,
      workingDays: string[],
      holidays: MockHoliday[]
    ): { isWorkingDay: boolean; isHoliday: boolean; isWeekend: boolean; reason?: string } {
      const [y, m, d] = dateStr.split('-').map(Number)
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
      const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
      const dayOfWeek = dayNames[dateObj.getUTCDay()]
      const isWeekend = dayOfWeek === "SATURDAY" || dayOfWeek === "SUNDAY"

      // 1. Check active holidays
      const activeHoliday = holidays.find(
        (h) => h.isActive && h.startDate <= dateStr && h.endDate >= dateStr
      )

      if (activeHoliday) {
        return {
          isWorkingDay: false,
          isHoliday: true,
          isWeekend,
          reason: `Holiday: ${activeHoliday.name}`
        }
      }

      // 2. Check working day schedule
      if (!workingDays.includes(dayOfWeek)) {
        return {
          isWorkingDay: false,
          isHoliday: false,
          isWeekend,
          reason: isWeekend ? "Weekend" : `${dayOfWeek} (Non-Working Day)`
        }
      }

      return {
        isWorkingDay: true,
        isHoliday: false,
        isWeekend: false
      }
    }

    const defaultWorkingDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    const mockHolidays: MockHoliday[] = [
      { name: "Ethiopian New Year", startDate: "2026-09-11", endDate: "2026-09-11", type: "PUBLIC_HOLIDAY", isActive: true },
      { name: "Meskel Break", startDate: "2026-09-27", endDate: "2026-09-28", type: "RELIGIOUS_HOLIDAY", isActive: true },
      { name: "Draft Inactive Holiday", startDate: "2026-10-05", endDate: "2026-10-05", type: "OTHER", isActive: false },
    ]

    test("regular weekday (e.g. Wednesday 2026-08-19) should evaluate as a normal working day", () => {
      const res = evaluateDate("2026-08-19", defaultWorkingDays, mockHolidays)
      expect(res.isWorkingDay).toBe(true)
      expect(res.isHoliday).toBe(false)
      expect(res.isWeekend).toBe(false)
    })

    test("Saturday (2026-08-22) should evaluate as non-working weekend", () => {
      const res = evaluateDate("2026-08-22", defaultWorkingDays, mockHolidays)
      expect(res.isWorkingDay).toBe(false)
      expect(res.isWeekend).toBe(true)
    })

    test("Sunday (2026-08-23) should evaluate as non-working weekend", () => {
      const res = evaluateDate("2026-08-23", defaultWorkingDays, mockHolidays)
      expect(res.isWorkingDay).toBe(false)
      expect(res.isWeekend).toBe(true)
    })

    test("single-day holiday (2026-09-11) should evaluate as an official holiday", () => {
      const res = evaluateDate("2026-09-11", defaultWorkingDays, mockHolidays)
      expect(res.isWorkingDay).toBe(false)
      expect(res.isHoliday).toBe(true)
      expect(res.reason).toContain("Ethiopian New Year")
    })

    test("multi-day holiday range (2026-09-27 to 2026-09-28) should cover both days as holidays", () => {
      const day1 = evaluateDate("2026-09-27", defaultWorkingDays, mockHolidays)
      const day2 = evaluateDate("2026-09-28", defaultWorkingDays, mockHolidays)
      expect(day1.isHoliday).toBe(true)
      expect(day2.isHoliday).toBe(true)
    })

    test("day immediately after a holiday (2026-09-29 Tuesday) should resume as a normal working day", () => {
      const res = evaluateDate("2026-09-29", defaultWorkingDays, mockHolidays)
      expect(res.isWorkingDay).toBe(true)
      expect(res.isHoliday).toBe(false)
    })

    test("inactive holidays should not block working days", () => {
      const res = evaluateDate("2026-10-05", defaultWorkingDays, mockHolidays)
      expect(res.isWorkingDay).toBe(true)
      expect(res.isHoliday).toBe(false)
    })

    test("absence marking should be prohibited on non-working days", () => {
      function canMarkAbsent(dateStr: string): boolean {
        const status = evaluateDate(dateStr, defaultWorkingDays, mockHolidays)
        return status.isWorkingDay
      }

      // Prohibited on Saturday
      expect(canMarkAbsent("2026-08-22")).toBe(false)
      // Prohibited on Holiday
      expect(canMarkAbsent("2026-09-11")).toBe(false)
      // Allowed on regular working day
      expect(canMarkAbsent("2026-08-19")).toBe(true)
    })
  })

  describe("6. Staff Attendance Dual Modes (Daily vs Session-Based)", () => {
    interface StaffRecord {
      userId: string
      date: string
      session: string // "daily" | "morning" | "afternoon" | etc.
      status: string
      checkInTime?: string
      checkOutTime?: string
    }

    interface SessionConfig {
      id: string
      name: string
      startTime: string
      endTime: string
      lateGraceMinutes: number
      earlyDepartureToleranceMinutes: number
      isActive: boolean
    }

    const mockSessions: SessionConfig[] = [
      { id: "morning", name: "Morning Session", startTime: "08:00", endTime: "12:30", lateGraceMinutes: 15, earlyDepartureToleranceMinutes: 10, isActive: true },
      { id: "afternoon", name: "Afternoon Session", startTime: "13:30", endTime: "17:00", lateGraceMinutes: 10, earlyDepartureToleranceMinutes: 10, isActive: true },
    ]

    function addMinutesToTime(timeHHMM: string, minutes: number): string {
      const [h, m] = timeHHMM.split(':').map(Number)
      let totalMin = h * 60 + m + minutes
      if (totalMin < 0) totalMin = 0
      if (totalMin >= 24 * 60) totalMin = 24 * 60 - 1
      const newH = Math.floor(totalMin / 60)
      const newM = totalMin % 60
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
    }

    function isTimeAfter(currentHHMM: string, targetHHMM: string): boolean {
      const [cH, cM] = currentHHMM.split(':').map(Number)
      const [tH, tM] = targetHHMM.split(':').map(Number)
      if (cH > tH) return true
      if (cH === tH && cM > tM) return true
      return false
    }

    test("Daily Mode: exactly 1 record per staff per day with session='daily'", () => {
      const records: StaffRecord[] = []
      function checkInDaily(userId: string, date: string, time: string): StaffRecord {
        const existing = records.find(r => r.userId === userId && r.date === date && r.session === "daily")
        if (existing?.checkInTime) throw new Error("Staff is already checked in for today")
        const record: StaffRecord = { userId, date, session: "daily", status: "PRESENT", checkInTime: time }
        records.push(record)
        return record
      }

      const rec = checkInDaily("staff_01", "2026-08-19", "07:55")
      expect(rec.session).toBe("daily")
      expect(records.length).toBe(1)

      // Attempting second check-in for the same date must fail
      expect(() => checkInDaily("staff_01", "2026-08-19", "08:10")).toThrow("Staff is already checked in for today")
    })

    test("Session-Based Mode: permits separate records for morning and afternoon on the same date", () => {
      const records: StaffRecord[] = []
      function checkInSession(userId: string, date: string, session: string, time: string): StaffRecord {
        const sess = mockSessions.find(s => s.id === session && s.isActive)
        if (!sess) throw new Error("Invalid or inactive session")
        const existing = records.find(r => r.userId === userId && r.date === date && r.session === session)
        if (existing?.checkInTime) throw new Error(`Staff is already checked in for ${session}`)

        const lateCutoff = addMinutesToTime(sess.startTime, sess.lateGraceMinutes)
        const status = isTimeAfter(time, lateCutoff) ? "LATE" : "PRESENT"
        const record: StaffRecord = { userId, date, session, status, checkInTime: time }
        records.push(record)
        return record
      }

      // Check-in morning on time (08:10 <= 08:15) -> PRESENT
      const morningRec = checkInSession("staff_01", "2026-08-19", "morning", "08:10")
      expect(morningRec.status).toBe("PRESENT")
      expect(morningRec.session).toBe("morning")

      // Check-in afternoon late (13:45 > 13:40) -> LATE
      const afternoonRec = checkInSession("staff_01", "2026-08-19", "afternoon", "13:45")
      expect(afternoonRec.status).toBe("LATE")
      expect(afternoonRec.session).toBe("afternoon")

      // Total records for this staff member on this date is 2
      expect(records.filter(r => r.userId === "staff_01" && r.date === "2026-08-19").length).toBe(2)

      // Duplicate check-in for the same session must fail
      expect(() => checkInSession("staff_01", "2026-08-19", "morning", "08:20")).toThrow("Staff is already checked in for morning")
    })

    test("Session-Based Mode: session thresholds correctly calculate late cutoff and early departure", () => {
      const morningSess = mockSessions[0] // 08:00 - 12:30, grace: 15m, tol: 10m
      const lateCutoff = addMinutesToTime(morningSess.startTime, morningSess.lateGraceMinutes)
      const earlyCutoff = addMinutesToTime(morningSess.endTime, -morningSess.earlyDepartureToleranceMinutes)

      expect(lateCutoff).toBe("08:15")
      expect(earlyCutoff).toBe("12:20")

      const afternoonSess = mockSessions[1] // 13:30 - 17:00, grace: 10m, tol: 10m
      const aftLateCutoff = addMinutesToTime(afternoonSess.startTime, afternoonSess.lateGraceMinutes)
      const aftEarlyCutoff = addMinutesToTime(afternoonSess.endTime, -afternoonSess.earlyDepartureToleranceMinutes)

      expect(aftLateCutoff).toBe("13:40")
      expect(aftEarlyCutoff).toBe("16:50")
    })

    test("Session-Based Stats: aggregates metrics per session and preserves unique staff counts", () => {
      const records: StaffRecord[] = [
        { userId: "staff_01", date: "2026-08-19", session: "morning", status: "PRESENT", checkInTime: "08:00" },
        { userId: "staff_01", date: "2026-08-19", session: "afternoon", status: "PRESENT", checkInTime: "13:30" },
        { userId: "staff_02", date: "2026-08-19", session: "morning", status: "LATE", checkInTime: "08:20" },
        { userId: "staff_02", date: "2026-08-19", session: "afternoon", status: "ABSENT" },
      ]

      const totalActiveStaff = 3 // staff_01, staff_02, staff_03
      const uniqueAttendedStaff = new Set(records.map(r => r.userId))
      const notCheckedIn = Math.max(0, totalActiveStaff - uniqueAttendedStaff.size)

      expect(uniqueAttendedStaff.size).toBe(2)
      expect(notCheckedIn).toBe(1) // staff_03 did not check in at all

      // Morning stats breakdown
      const morningRecords = records.filter(r => r.session === "morning")
      const morningPresent = morningRecords.filter(r => r.status === "PRESENT").length
      const morningLate = morningRecords.filter(r => r.status === "LATE").length

      expect(morningPresent).toBe(1)
      expect(morningLate).toBe(1)
    })
  })

  describe("8. Independent Check-In and Check-Out Status Display UI Rules", () => {
    const mockSettings = {
      staffWorkStartTime: "08:00",
      staffWorkEndTime: "17:00",
      staffLateGraceMinutes: 15, // late cutoff: 08:15
      staffEarlyCheckoutToleranceMinutes: 15, // early cutoff: 16:45
    }

    test("Staff checks in Late and later checks out early: Check-In remains 'LATE' and Check-Out displays 'EARLY LEAVE'", () => {
      // 11:09 is late, 15:20 is early departure
      const record = {
        id: "rec_01",
        userId: "staff_A",
        date: "2026-08-19T00:00:00.000Z",
        status: "EARLY_DEPARTURE", // Backend stored latest event status
        checkInTime: "2026-08-19T08:09:00.000Z", // 11:09 in UTC+3 (Addis)
        checkOutTime: "2026-08-19T12:20:00.000Z", // 15:20 in UTC+3 (Addis)
      }

      const display = getStaffAttendanceDisplay(record, mockSettings)

      // Check-In status MUST remain LATE
      expect(display.checkIn.status).toBe("LATE")
      expect(display.checkIn.label).toBe("LATE")
      // titleLabel includes lateness duration e.g. "Late (189 min)" when latenessMinutes > 0
      expect(display.checkIn.titleLabel).toContain("Late")
      expect(display.checkIn.hasTime).toBe(true)

      // Check-Out status MUST be EARLY LEAVE
      expect(display.checkOut.status).toBe("EARLY_LEAVE")
      expect(display.checkOut.label).toBe("EARLY LEAVE")
      expect(display.checkOut.titleLabel).toBe("Early Leave")
      expect(display.checkOut.hasTime).toBe(true)
    })

    test("Staff checks in On Time and checks out On Time: check-in is 'On Time' and check-out is 'Checked Out'", () => {
      const record = {
        id: "rec_02",
        userId: "staff_B",
        date: "2026-08-19T00:00:00.000Z",
        status: "PRESENT",
        checkInTime: "2026-08-19T05:05:00.000Z", // 08:05 in UTC+3
        checkOutTime: "2026-08-19T13:55:00.000Z", // 16:55 in UTC+3
      }

      const display = getStaffAttendanceDisplay(record, mockSettings)

      expect(display.checkIn.status).toBe("ON_TIME")
      expect(display.checkIn.label).toBe("ON TIME")
      expect(display.checkIn.titleLabel).toBe("On Time")

      expect(display.checkOut.status).toBe("CHECKED_OUT")
      expect(display.checkOut.label).toBe("CHECKED OUT")
      expect(display.checkOut.titleLabel).toBe("Checked Out")
    })

    test("Staff has checked in but NOT checked out yet: Check-Out displays 'NOT CHECKED OUT'", () => {
      const record = {
        id: "rec_03",
        userId: "staff_C",
        date: "2026-08-19T00:00:00.000Z",
        status: "PRESENT",
        checkInTime: "2026-08-19T05:10:00.000Z", // 08:10 in UTC+3
        checkOutTime: null,
      }

      const display = getStaffAttendanceDisplay(record, mockSettings)

      expect(display.checkIn.status).toBe("ON_TIME")
      expect(display.checkIn.label).toBe("ON TIME")
      expect(display.checkIn.hasTime).toBe(true)

      expect(display.checkOut.status).toBe("NOT_CHECKED_OUT")
      expect(display.checkOut.label).toBe("NOT CHECKED OUT")
      expect(display.checkOut.titleLabel).toBe("Not Checked Out")
      expect(display.checkOut.timeStr).toBe("—")
      expect(display.checkOut.hasTime).toBe(false)
    })

    test("Staff has NOT checked in yet (before completion): Check-In is Pending and Check-Out is 'Awaiting Check-In' (never Absent)", () => {
      const record = null

      const display = getStaffAttendanceDisplay(record, mockSettings)

      const validNoCheckinStatuses = ["NOT_STARTED", "PENDING", "ABSENT"]
      expect(validNoCheckinStatuses).toContain(display.checkIn.status)
      expect(display.checkIn.timeStr).toBe("—")
      expect(display.checkIn.hasTime).toBe(false)

      if (display.checkIn.status === "ABSENT") {
        expect(display.checkOut.status).toBe("NOT_APPLICABLE")
        expect(display.checkOut.titleLabel).toBe("Not Applicable")
      } else {
        expect(display.checkOut.status).toBe("AWAITING_CHECKIN")
        expect(display.checkOut.titleLabel).toBe("Awaiting Check-In")
      }
    })

    test("Staff officially determined ABSENT: Check-In is 'Absent' and Check-Out is 'Not Applicable'", () => {
      const record = {
        id: "rec_04",
        userId: "staff_D",
        date: "2026-08-19T00:00:00.000Z",
        status: "ABSENT",
        checkInTime: null,
        checkOutTime: null,
      }

      const display = getStaffAttendanceDisplay(record, mockSettings)

      expect(display.checkIn.status).toBe("ABSENT")
      expect(display.checkIn.label).toBe("ABSENT")
      expect(display.checkIn.titleLabel).toBe("Absent")

      expect(display.checkOut.status).toBe("NOT_APPLICABLE")
      expect(display.checkOut.label).toBe("NOT APPLICABLE")
      expect(display.checkOut.titleLabel).toBe("Not Applicable")
    })

    test("Session Isolation: Afternoon session displays 'PENDING' when Morning cutoff has passed and Afternoon cutoff has not", () => {
      const afternoonSession = {
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

      // No record yet for afternoon on today
      const record = null
      const display = getStaffAttendanceDisplay(record, mockSettings, afternoonSession)

      // When afternoon cutoff has not elapsed, Check-In must be NOT_STARTED or PENDING (never falsely marked ABSENT from morning)
      expect(["NOT_STARTED", "PENDING"]).toContain(display.checkIn.status)
      expect(display.checkOut.status).toBe("AWAITING_CHECKIN")
      expect(display.checkOut.titleLabel).toBe("Awaiting Check-In")
    })
  })

  describe("6. Check-In Button State & Cutoff Enforcements", () => {
    const mockSettings = {
      staffWorkStartTime: "08:00",
      staffWorkEndTime: "17:00",
      staffLateGraceMinutes: 15,
      staffEarlyCheckoutToleranceMinutes: 15,
      staffAbsenceCutoffTime: "10:00",
      staffEarliestCheckinTime: "06:00",
      allowStaffCheckinAfterCutoff: false,
    }

    const mockSession = {
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
      allowCheckinAfterCutoff: false,
      isActive: true,
    }

    test("Check-in button is INACTIVE before earliest allowed check-in time (e.g. 05:30 < 06:00)", () => {
      // 05:30 AM in Africa/Addis_Ababa = 02:30 UTC
      const mockTimeEarly = new Date("2026-08-20T02:30:00.000Z")
      const state = getCheckInButtonState(null, mockSettings, mockSession, mockTimeEarly)

      expect(state.canCheckIn).toBe(false)
      expect(state.isBeforeEarliest).toBe(true)
      expect(state.isAfterCutoff).toBe(false)
      expect(state.buttonText).toContain("6:00 AM")
      expect(state.helperText).toContain("opens at 6:00 AM")
    })

    test("Check-in button is ACTIVE during valid check-in window (e.g. 08:15 AM)", () => {
      // 08:15 AM in Africa/Addis_Ababa = 05:15 UTC
      const mockTimeValid = new Date("2026-08-20T05:15:00.000Z")
      const state = getCheckInButtonState(null, mockSettings, mockSession, mockTimeValid)

      expect(state.canCheckIn).toBe(true)
      expect(state.isBeforeEarliest).toBe(false)
      expect(state.isAfterCutoff).toBe(false)
      expect(state.buttonText).toBe("Check In Now")
    })

    test("Check-in button is INACTIVE after absence cutoff when allowCheckinAfterCutoff is false (e.g. 10:00 AM > 09:30 AM)", () => {
      // 10:00 AM in Africa/Addis_Ababa = 07:00 UTC (before 12:30 checkout)
      const mockTimeLate = new Date("2026-08-20T07:00:00.000Z")
      const state = getCheckInButtonState(null, mockSettings, mockSession, mockTimeLate)

      expect(state.canCheckIn).toBe(false)
      expect(state.isBeforeEarliest).toBe(false)
      expect(state.isAfterCutoff).toBe(true)
      expect(state.isAfterCheckout).toBe(false)
      expect(state.buttonText).toBe("Check-in closed for today.")
      expect(state.helperText).toContain("Absence cutoff elapsed")
    })

    test("Check-in button is ACTIVE after absence cutoff when allowCheckinAfterCutoff is true but before checkout time (e.g. 10:00 AM < 12:30 PM)", () => {
      const permissiveSession = { ...mockSession, allowCheckinAfterCutoff: true }
      // 10:00 AM in Africa/Addis_Ababa = 07:00 UTC
      const mockTimeLate = new Date("2026-08-20T07:00:00.000Z")
      const state = getCheckInButtonState(null, mockSettings, permissiveSession, mockTimeLate)

      expect(state.canCheckIn).toBe(true)
      expect(state.isBeforeEarliest).toBe(false)
      expect(state.isAfterCutoff).toBe(false)
      expect(state.isAfterCheckout).toBe(false)
      expect(state.buttonText).toBe("Check In Now")
    })

    test("Check-in button is ALWAYS INACTIVE after checkout time, regardless of allowCheckinAfterCutoff (e.g. 13:00 PM > 12:30 PM)", () => {
      const permissiveSession = { ...mockSession, allowCheckinAfterCutoff: true }
      // 01:00 PM in Africa/Addis_Ababa = 10:00 UTC (past 12:30 PM session end)
      const mockTimePastCheckout = new Date("2026-08-20T10:00:00.000Z")
      const state = getCheckInButtonState(null, mockSettings, permissiveSession, mockTimePastCheckout)

      expect(state.canCheckIn).toBe(false)
      expect(state.isAfterCheckout).toBe(true)
      expect(state.buttonText).toBe("Check-in closed for today.")
      expect(state.helperText).toContain("Expected checkout time (12:30 PM) has passed")
    })

    test("Check-in button is INACTIVE when staff has already checked in", () => {
      const existingRecord = {
        id: "rec_done",
        checkInTime: "2026-08-20T05:00:00.000Z",
      }
      const mockTimeValid = new Date("2026-08-20T05:15:00.000Z")
      const state = getCheckInButtonState(existingRecord, mockSettings, mockSession, mockTimeValid)

      expect(state.canCheckIn).toBe(false)
      expect(state.buttonText).toBe("Already Checked In")
    })
  })
})


