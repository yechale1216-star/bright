import {
  calculateEuclideanDistance,
  calculateCosineSimilarity,
  normalizeL2Vector,
  isValidFaceDescriptor,
  calculateEAR,
  estimateHeadPose,
  evaluateLiveness,
  synthesizeStableEmbedding,
  FaceLandmarkPoint,
  FaceSampleItem,
} from "../lib/utils/biometric-quality"
import {
  DEFAULT_MATCH_THRESHOLD,
  FAST_SELF_ATTENDANCE_THRESHOLD,
} from "../lib/hooks/use-face-recognition"

describe("Staff Biometric Face Registration & Fast Verification Pipeline", () => {
  // Helper to generate normalized mock 128-d descriptor
  function createMockDescriptor(seed: number): number[] {
    const raw = Array.from({ length: 128 }, (_, i) => Math.sin(i * seed + 0.1) * Math.cos(i + seed))
    return normalizeL2Vector(raw)
  }

  describe("1. Descriptor Validation & Mathematical Metrics", () => {
    test("should validate standard 128-d float array", () => {
      const validDesc = createMockDescriptor(1.0)
      expect(isValidFaceDescriptor(validDesc)).toBe(true)
    })

    test("should reject corrupted or incomplete descriptors", () => {
      expect(isValidFaceDescriptor(null)).toBe(false)
      expect(isValidFaceDescriptor([])).toBe(false)
      expect(isValidFaceDescriptor(new Array(64).fill(0.1))).toBe(false)
      expect(isValidFaceDescriptor(new Array(128).fill(NaN))).toBe(false)
      expect(isValidFaceDescriptor(new Array(128).fill(0))).toBe(false)
    })

    test("normalizeL2Vector should produce unit length vector (norm = 1.0)", () => {
      const raw = Array.from({ length: 128 }, () => Math.random() * 10 - 5)
      const normalized = normalizeL2Vector(raw)
      const norm = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0))
      expect(norm).toBeCloseTo(1.0, 5)
    })

    test("cosine similarity between identical normalized vectors should be 1.0", () => {
      const desc = createMockDescriptor(2.5)
      const sim = calculateCosineSimilarity(desc, desc)
      expect(sim).toBeCloseTo(1.0, 5)
    })

    test("cosine similarity between orthogonal/different vectors should be low", () => {
      const descA = createMockDescriptor(1.0)
      const descB = createMockDescriptor(7.0)
      const sim = calculateCosineSimilarity(descA, descB)
      expect(sim).toBeLessThan(0.70)
    })
  })

  describe("2. Head Pose & Facial Landmark Quality", () => {
    // Generate synthetic 68-point frontal face landmarks
    function createSyntheticLandmarks(options: { rollOffset?: number; yawRatioOffset?: number } = {}): FaceLandmarkPoint[] {
      const points: FaceLandmarkPoint[] = []
      const roll = options.rollOffset || 0
      const yaw = options.yawRatioOffset || 0

      for (let i = 0; i < 68; i++) {
        points.push({ x: 200 + i * 2, y: 200 + i * 2 })
      }

      // Left eye (36..41) center approx (180, 180)
      points[36] = { x: 160, y: 180 - roll }
      points[37] = { x: 170, y: 175 - roll }
      points[38] = { x: 180, y: 175 - roll }
      points[39] = { x: 190, y: 180 - roll }
      points[40] = { x: 180, y: 185 - roll }
      points[41] = { x: 170, y: 185 - roll }

      // Right eye (42..47) center approx (240, 180)
      points[42] = { x: 230, y: 180 + roll }
      points[43] = { x: 240, y: 175 + roll }
      points[44] = { x: 250, y: 175 + roll }
      points[45] = { x: 260, y: 180 + roll }
      points[46] = { x: 250, y: 185 + roll }
      points[47] = { x: 240, y: 185 + roll }

      // Nose tip (30)
      points[30] = { x: 210 + yaw, y: 220 }

      // Chin (8)
      points[8] = { x: 210, y: 280 }

      return points
    }

    test("should accept upright frontal face pose", () => {
      const landmarks = createSyntheticLandmarks()
      const pose = estimateHeadPose(landmarks)
      expect(pose.isAcceptable).toBe(true)
      expect(Math.abs(pose.roll)).toBeLessThanOrEqual(16)
    })

    test("should detect excessive head roll (tilt)", () => {
      const tiltedLandmarks = createSyntheticLandmarks({ rollOffset: 30 })
      const pose = estimateHeadPose(tiltedLandmarks)
      expect(pose.isAcceptable).toBe(false)
      expect(Math.abs(pose.roll)).toBeGreaterThan(16)
    })

    test("should calculate Eye Aspect Ratio (EAR) properly", () => {
      const landmarks = createSyntheticLandmarks()
      const leftEar = calculateEAR(landmarks, "left")
      expect(leftEar).toBeGreaterThan(0.15)
      expect(leftEar).toBeLessThan(0.45)
    })
  })

  describe("3. Temporal Anti-Spoof Liveness Heuristics", () => {
    test("should reject static image spoof with zero landmark variance", () => {
      const current = Array.from({ length: 68 }, (_, i) => ({ x: 100 + i, y: 100 + i }))
      // 6 consecutive historical frames with exact identical coordinates (printed photo / static screen)
      const history = Array.from({ length: 6 }, () => current)

      const result = evaluateLiveness(current, history)
      expect(result.isLive).toBe(false)
      expect(result.reason).toContain("Static image detected")
    })

    test("should accept natural live facial micro-movements", () => {
      const current = Array.from({ length: 68 }, (_, i) => ({ x: 100 + i, y: 100 + i }))
      // Historical frames with natural micro-tremor (~0.5 - 1.5px variance)
      const history = Array.from({ length: 5 }, (_, h) =>
        Array.from({ length: 68 }, (_, i) => ({
          x: 100 + i + Math.sin(h + i) * 0.8,
          y: 100 + i + Math.cos(h + i) * 0.8,
        }))
      )

      const result = evaluateLiveness(current, history)
      expect(result.isLive).toBe(true)
      expect(result.temporalVariance).toBeGreaterThan(0.1)
    })
  })

  describe("4. Multi-Sample Stable Embedding Synthesis", () => {
    test("should synthesize a stable centroid from 5 consistent samples", () => {
      const baseVector = createMockDescriptor(3.14)
      const samples: FaceSampleItem[] = Array.from({ length: 5 }, (_, i) => {
        // Slight natural variations across samples (lighting, expression)
        const perturbed = baseVector.map((v) => v + (Math.random() - 0.5) * 0.02)
        return {
          descriptor: normalizeL2Vector(perturbed),
          qualityScore: 0.90 - i * 0.02,
          timestamp: 1000 + i * 200,
        }
      })

      const stable = synthesizeStableEmbedding(samples)
      expect(stable.samplesUsed).toBe(5)
      expect(stable.outliersDropped).toBe(0)
      expect(stable.descriptor.length).toBe(128)

      // Ensure stable descriptor has exact L2 unit norm
      const norm = Math.sqrt(stable.descriptor.reduce((sum, v) => sum + v * v, 0))
      expect(norm).toBeCloseTo(1.0, 5)

      // Distance between base vector and synthesized centroid should be near 0
      const dist = calculateEuclideanDistance(baseVector, stable.descriptor)
      expect(dist).toBeLessThan(0.08)
    })

    test("should detect and drop outlier samples during enrollment", () => {
      const baseVector = createMockDescriptor(4.0)
      const normalSamples: FaceSampleItem[] = Array.from({ length: 4 }, (_, i) => ({
        descriptor: normalizeL2Vector(baseVector.map((v) => v + (Math.random() - 0.5) * 0.01)),
        qualityScore: 0.88,
        timestamp: 1000 + i * 200,
      }))

      // 1 corrupt/glitched sample (e.g. sudden camera flash, wrong person stepped in)
      const outlierSample: FaceSampleItem = {
        descriptor: createMockDescriptor(99.0),
        qualityScore: 0.70,
        timestamp: 2000,
      }

      const allSamples = [...normalSamples, outlierSample]
      const stable = synthesizeStableEmbedding(allSamples)

      expect(stable.outliersDropped).toBe(1)
      expect(stable.samplesUsed).toBe(4)

      // Stable template remains close to the genuine base vector
      const dist = calculateEuclideanDistance(baseVector, stable.descriptor)
      expect(dist).toBeLessThan(0.20)
    })
  })

  describe("5. Self-Attendance Verification Match Tolerance", () => {
    test("should reliably match the enrolled stable template with live query under natural lighting shifts", () => {
      const enrolledTemplate = createMockDescriptor(5.5)
      // Live query with minor lighting difference (small perturbation)
      const liveQuery = normalizeL2Vector(enrolledTemplate.map((v) => v + 0.02))

      const distance = calculateEuclideanDistance(liveQuery, enrolledTemplate)
      const cosineSim = calculateCosineSimilarity(liveQuery, enrolledTemplate)

      expect(distance).toBeLessThan(FAST_SELF_ATTENDANCE_THRESHOLD)
      expect(cosineSim).toBeGreaterThan(0.85)
    })

    test("should firmly reject impostors / different staff members", () => {
      const staffATemplate = createMockDescriptor(1.23)
      const staffBQuery = createMockDescriptor(8.91)

      const distance = calculateEuclideanDistance(staffBQuery, staffATemplate)
      expect(distance).toBeGreaterThan(DEFAULT_MATCH_THRESHOLD)
    })

    test("should flag verification mismatch when face is detected but does not match template", () => {
      const enrolledTemplate = createMockDescriptor(3.14)
      const nonMatchingLiveFace = createMockDescriptor(7.89)

      const distance = calculateEuclideanDistance(nonMatchingLiveFace, enrolledTemplate)
      const cosineSim = calculateCosineSimilarity(nonMatchingLiveFace, enrolledTemplate)

      const isMatch = distance <= FAST_SELF_ATTENDANCE_THRESHOLD && cosineSim >= 0.80
      expect(isMatch).toBe(false)
      expect(distance).toBeGreaterThan(FAST_SELF_ATTENDANCE_THRESHOLD)
    })
  })
})
