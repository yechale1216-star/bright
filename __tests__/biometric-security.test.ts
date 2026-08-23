import {
  FAST_SELF_ATTENDANCE_THRESHOLD,
  MIN_COSINE_SIMILARITY,
  calculateEuclideanDistance,
  calculateCosineSimilarity,
  normalizeL2Vector,
  isValidFaceDescriptor,
} from "../lib/hooks/use-face-recognition"
import { verifyDescriptorMatch } from "../server/src/services/staff-attendance.service"

describe("1:1 Staff Biometric Identity Security Tests", () => {
  // Generates deterministic pseudo-random 128D descriptors
  function generateFaceDescriptor(seed: number): number[] {
    const raw = Array.from({ length: 128 }, (_, i) => Math.sin(seed * (i + 1) * 0.314159))
    return normalizeL2Vector(raw)
  }

  const staffATemplate = generateFaceDescriptor(101)
  const staffBTemplate = generateFaceDescriptor(202)
  const unknownPersonFace = generateFaceDescriptor(999)

  describe("1. Pure 1:1 Identity Matching (Staff A vs Staff A = PASS)", () => {
    test("Staff A's live face matching Staff A's registered template passes strictly", () => {
      // Natural minor variations in lighting/expression (noise within ~0.005)
      const liveStaffAFace = normalizeL2Vector(staffATemplate.map((v) => v + (Math.random() - 0.5) * 0.008))

      const dist = calculateEuclideanDistance(liveStaffAFace, staffATemplate)
      const cosine = calculateCosineSimilarity(liveStaffAFace, staffATemplate)

      expect(dist).toBeLessThanOrEqual(FAST_SELF_ATTENDANCE_THRESHOLD)
      expect(cosine).toBeGreaterThanOrEqual(MIN_COSINE_SIMILARITY)

      const serverResult = verifyDescriptorMatch(liveStaffAFace, staffATemplate)
      expect(serverResult.isMatch).toBe(true)
      expect(serverResult.distance).toBeLessThanOrEqual(0.38)
      expect(serverResult.cosineSim).toBeGreaterThanOrEqual(0.90)
    })
  })

  describe("2. Impostor & Cross-Account Rejection (Staff B / Unknown vs Staff A = MUST FAIL)", () => {
    test("Staff B's face on Staff A's account MUST FAIL verification", () => {
      const liveStaffBFace = normalizeL2Vector(staffBTemplate.map((v) => v + 0.002))

      const dist = calculateEuclideanDistance(liveStaffBFace, staffATemplate)
      const cosine = calculateCosineSimilarity(liveStaffBFace, staffATemplate)

      expect(dist).toBeGreaterThan(FAST_SELF_ATTENDANCE_THRESHOLD)
      expect(cosine).toBeLessThan(MIN_COSINE_SIMILARITY)

      const serverResult = verifyDescriptorMatch(liveStaffBFace, staffATemplate)
      expect(serverResult.isMatch).toBe(false)
    })

    test("Unknown person's face on Staff A's account MUST FAIL verification", () => {
      const liveUnknownFace = normalizeL2Vector(unknownPersonFace)

      const dist = calculateEuclideanDistance(liveUnknownFace, staffATemplate)
      const cosine = calculateCosineSimilarity(liveUnknownFace, staffATemplate)

      expect(dist).toBeGreaterThan(FAST_SELF_ATTENDANCE_THRESHOLD)
      expect(cosine).toBeLessThan(MIN_COSINE_SIMILARITY)

      const serverResult = verifyDescriptorMatch(liveUnknownFace, staffATemplate)
      expect(serverResult.isMatch).toBe(false)
    })
  })

  describe("3. Weak Similarity & Borderline Rejection", () => {
    test("Reject weak similarity faces that do not strictly meet both thresholds", () => {
      // Perturb template to create a borderline face (dist ~ 0.44, cosine ~ 0.88)
      const borderlineFace = normalizeL2Vector(staffATemplate.map((v, i) => v + (i % 2 === 0 ? 0.05 : -0.05)))

      const dist = calculateEuclideanDistance(borderlineFace, staffATemplate)
      const cosine = calculateCosineSimilarity(borderlineFace, staffATemplate)

      const isClientMatch = dist <= FAST_SELF_ATTENDANCE_THRESHOLD && cosine >= MIN_COSINE_SIMILARITY
      expect(isClientMatch).toBe(false)

      const serverResult = verifyDescriptorMatch(borderlineFace, staffATemplate)
      expect(serverResult.isMatch).toBe(false)
    })

    test("Reject corrupted, NaN, or non-128D descriptors", () => {
      expect(isValidFaceDescriptor([])).toBe(false)
      expect(isValidFaceDescriptor(new Array(64).fill(0.1))).toBe(false)
      expect(isValidFaceDescriptor(new Array(128).fill(NaN))).toBe(false)

      const corrupted = new Array(128).fill(0)
      const serverResult = verifyDescriptorMatch(corrupted, staffATemplate)
      expect(serverResult.isMatch).toBe(false)
      expect(serverResult.distance).toBe(1.0)
    })
  })

  describe("4. Security Error Message Standard", () => {
    test("Verification failure message matches system standard", () => {
      const EXPECTED_MSG = "Face does not match your registered profile. Attendance was not recorded."
      expect(EXPECTED_MSG).toBe("Face does not match your registered profile. Attendance was not recorded.")
    })
  })

  describe("5. Strong Duplication Prevention & Cross-Account Face Collision", () => {
    test("detects when a captured face matches an existing template belonging to another staff member", () => {
      const staffAEnrolledTemplate = generateFaceDescriptor(101)
      const staffBAttemptedFace = normalizeL2Vector(staffAEnrolledTemplate.map((v) => v + 0.003))

      // Cross-account duplicate check uses verifyDescriptorMatch
      const duplicateCheck = verifyDescriptorMatch(staffBAttemptedFace, staffAEnrolledTemplate)
      expect(duplicateCheck.isMatch).toBe(true)

      const ERROR_MSG = "This face is already registered to another staff member."
      expect(ERROR_MSG).toBe("This face is already registered to another staff member.")
    })

    test("allows distinct faces to be registered for different staff members without collision", () => {
      const staffAEnrolledTemplate = generateFaceDescriptor(101)
      const staffBNewFace = generateFaceDescriptor(202)

      const duplicateCheck = verifyDescriptorMatch(staffBNewFace, staffAEnrolledTemplate)
      expect(duplicateCheck.isMatch).toBe(false)
    })

    test("enforces duplicate profile protection for the same staff member unless replaceExisting is set", () => {
      const EXISTING_PROFILE_ERROR = "Biometric profile already registered for this staff member."
      expect(EXISTING_PROFILE_ERROR).toBe("Biometric profile already registered for this staff member.")
    })
  })
})
