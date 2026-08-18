import { calculateDistanceMeters } from "../lib/utils/geofence"
import { calculateEuclideanDistance } from "../lib/hooks/use-face-recognition"

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
})

