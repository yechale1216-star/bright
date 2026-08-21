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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

function createMockDescriptor(seed: number): number[] {
  const raw = Array.from({ length: 128 }, (_, i) => Math.sin(i * seed + 0.1) * Math.cos(i + seed))
  return normalizeL2Vector(raw)
}

function createSyntheticLandmarks(options: { rollOffset?: number; yawRatioOffset?: number } = {}): FaceLandmarkPoint[] {
  const points: FaceLandmarkPoint[] = []
  const roll = options.rollOffset || 0
  const yaw = options.yawRatioOffset || 0

  for (let i = 0; i < 68; i++) {
    points.push({ x: 200 + i * 2, y: 200 + i * 2 })
  }

  points[36] = { x: 160, y: 180 - roll }
  points[37] = { x: 170, y: 175 - roll }
  points[38] = { x: 180, y: 175 - roll }
  points[39] = { x: 190, y: 180 - roll }
  points[40] = { x: 180, y: 185 - roll }
  points[41] = { x: 170, y: 185 - roll }

  points[42] = { x: 230, y: 180 + roll }
  points[43] = { x: 240, y: 175 + roll }
  points[44] = { x: 250, y: 175 + roll }
  points[45] = { x: 260, y: 180 + roll }
  points[46] = { x: 250, y: 185 + roll }
  points[47] = { x: 240, y: 185 + roll }

  points[30] = { x: 210 + yaw, y: 220 }
  points[8] = { x: 210, y: 280 }

  return points
}

console.log("─── Running Biometric Verification Test Suite ───\n")

// Test 1: Vector normalization and descriptor validation
const validDesc = createMockDescriptor(1.0)
assert(isValidFaceDescriptor(validDesc), "Valid descriptor should pass validation")
assert(!isValidFaceDescriptor(null), "Null descriptor should fail validation")
assert(!isValidFaceDescriptor(new Array(64).fill(0.1)), "Wrong length descriptor should fail")
assert(!isValidFaceDescriptor(new Array(128).fill(NaN)), "NaN descriptor should fail")

const norm = Math.sqrt(validDesc.reduce((sum, v) => sum + v * v, 0))
assert(Math.abs(norm - 1.0) < 1e-4, "L2 normalized vector should have exact norm of 1.0")

// Test 2: Cosine similarity and Euclidean distance
const simSelf = calculateCosineSimilarity(validDesc, validDesc)
assert(Math.abs(simSelf - 1.0) < 1e-4, "Self cosine similarity should be 1.0")

const diffDesc = createMockDescriptor(9.0)
const simDiff = calculateCosineSimilarity(validDesc, diffDesc)
assert(simDiff < 0.70, "Different descriptors should have low cosine similarity")

// Test 3: Head pose estimation
const upright = createSyntheticLandmarks()
const poseUpright = estimateHeadPose(upright)
assert(poseUpright.isAcceptable, "Frontal upright face should be accepted")

const tilted = createSyntheticLandmarks({ rollOffset: 25 })
const poseTilted = estimateHeadPose(tilted)
assert(!poseTilted.isAcceptable, "Tilted face should be rejected with pose flag")

// Test 4: Liveness check
const current = Array.from({ length: 68 }, (_, i) => ({ x: 100 + i, y: 100 + i }))
const staticHistory = Array.from({ length: 6 }, () => current)
const livenessStatic = evaluateLiveness(current, staticHistory)
assert(!livenessStatic.isLive, "Static photo spoof with 0 variance should be rejected")

const liveHistory = Array.from({ length: 5 }, (_, h) =>
  Array.from({ length: 68 }, (_, i) => ({
    x: 100 + i + Math.sin(h + i) * 0.8,
    y: 100 + i + Math.cos(h + i) * 0.8,
  }))
)
const livenessDynamic = evaluateLiveness(current, liveHistory)
assert(livenessDynamic.isLive, "Live face with natural micro-movements should be confirmed")

// Test 5: Multi-sample embedding synthesis with outlier pruning
const baseVector = createMockDescriptor(3.14)
const samples: FaceSampleItem[] = Array.from({ length: 4 }, (_, i) => ({
  descriptor: normalizeL2Vector(baseVector.map((v) => v + (i * 0.005))),
  qualityScore: 0.90,
  timestamp: 1000 + i * 200,
}))
// Add 1 outlier
samples.push({
  descriptor: createMockDescriptor(88.0),
  qualityScore: 0.60,
  timestamp: 2000,
})

const stable = synthesizeStableEmbedding(samples)
assert(stable.samplesUsed === 4, "Should use exactly 4 inlier samples")
assert(stable.outliersDropped === 1, "Should drop 1 outlier sample")
const distFromBase = calculateEuclideanDistance(baseVector, stable.descriptor)
console.log(`[Test 5 Info] distFromBase = ${distFromBase.toFixed(4)}`)
assert(distFromBase < 0.20, "Synthesized stable embedding should be virtually identical to base vector")

// Test 6: Matching thresholds
const queryPerturbed = normalizeL2Vector(baseVector.map((v) => v + 0.02))
const matchDist = calculateEuclideanDistance(queryPerturbed, stable.descriptor)
assert(matchDist < FAST_SELF_ATTENDANCE_THRESHOLD, "Self-attendance match should succeed under normal micro-shifts")

const impostorQuery = createMockDescriptor(77.7)
const impostorDist = calculateEuclideanDistance(impostorQuery, stable.descriptor)
assert(impostorDist > DEFAULT_MATCH_THRESHOLD, "Impostor face must be firmly rejected")

console.log("\n🎉 All Biometric Registration & Verification Tests Passed Successfully!\n")
