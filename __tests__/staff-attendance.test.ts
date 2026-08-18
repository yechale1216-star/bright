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
})
