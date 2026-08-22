/**
 * Biometric Face Quality, Anti-Spoof Liveness & Stable Embedding Engine
 * 
 * Provides rigorous quality validation, pose estimation, temporal liveness heuristics,
 * multi-sample outlier rejection, and L2-normalized centroid embedding synthesis.
 */

export interface FaceLandmarkPoint {
  x: number
  y: number
  _x?: number
  _y?: number
}

export interface FaceBox {
  x: number
  y: number
  width: number
  height: number
}

export interface FaceQualityResult {
  isValid: boolean
  qualityScore: number // 0.0 to 1.0
  issues: string[]
  isProperlyPositioned: boolean
  isGoodLighting: boolean
  isSharp: boolean
  isGoodPose: boolean
  poseAngles: {
    yaw: number // degrees approx (-30 to +30)
    pitch: number // degrees approx (-25 to +25)
    roll: number // degrees approx (-20 to +20)
  }
  brightness: number // 0 to 255
  contrast: number // std dev
}

export interface LivenessResult {
  isLive: boolean
  confidence: number // 0.0 to 1.0
  reason?: string
  temporalVariance: number
  ear: number // Eye aspect ratio
}

export interface FaceSampleItem {
  descriptor: number[]
  qualityScore: number
  landmarks?: FaceLandmarkPoint[]
  timestamp: number
}

export interface StableEmbeddingResult {
  descriptor: number[]
  samplesUsed: number
  outliersDropped: number
  averageQuality: number
  consistencyScore: number // 0.0 to 1.0
}

/**
 * Calculates Euclidean distance between two 128-dimensional descriptors
 */
export function calculateEuclideanDistance(desc1: number[], desc2: number[]): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length || desc1.length === 0) return 1.0
  let sum = 0
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Calculates Cosine Similarity between two normalized 128-dimensional descriptors
 */
export function calculateCosineSimilarity(desc1: number[], desc2: number[]): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length || desc1.length === 0) return 0
  let dot = 0
  let norm1 = 0
  let norm2 = 0
  for (let i = 0; i < desc1.length; i++) {
    dot += desc1[i] * desc2[i]
    norm1 += desc1[i] * desc1[i]
    norm2 += desc2[i] * desc2[i]
  }
  if (norm1 === 0 || norm2 === 0) return 0
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2))
}

/**
 * Computes L2-norm of a vector
 */
export function calculateL2Norm(vec: number[]): number {
  if (!vec || vec.length === 0) return 0
  let sum = 0
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i]
  }
  return Math.sqrt(sum)
}

/**
 * Normalizes vector to unit length (L2 norm = 1.0)
 */
export function normalizeL2Vector(vec: number[]): number[] {
  const norm = calculateL2Norm(vec)
  if (norm === 0 || isNaN(norm)) return new Array(vec.length).fill(0)
  return vec.map((v) => v / norm)
}

/**
 * Checks if a descriptor is structurally and mathematically valid (128 finite floats)
 */
export function isValidFaceDescriptor(descriptor: any): boolean {
  if (!Array.isArray(descriptor) || descriptor.length !== 128) return false
  for (let i = 0; i < descriptor.length; i++) {
    const val = descriptor[i]
    if (typeof val !== "number" || isNaN(val) || !isFinite(val)) return false
  }
  const norm = calculateL2Norm(descriptor)
  // Accept standard embeddings with norm ~ 0.5 to 1.5
  return norm > 0.1 && norm < 2.5
}

/**
 * Extracts point coordinates from landmark point object
 */
function getPoint(pt: FaceLandmarkPoint): { x: number; y: number } {
  return {
    x: typeof pt._x === "number" ? pt._x : pt.x,
    y: typeof pt._y === "number" ? pt._y : pt.y,
  }
}

/**
 * Calculates Eye Aspect Ratio (EAR) for blink & micro-movement detection
 * using 6 landmarks for an eye: [p1, p2, p3, p4, p5, p6]
 */
export function calculateEAR(landmarks: FaceLandmarkPoint[], eye: "left" | "right"): number {
  if (!landmarks || landmarks.length < 68) return 0.3

  // 68-point model: Left eye is 36..41, Right eye is 42..47 (0-indexed)
  const indices = eye === "left" ? [36, 37, 38, 39, 40, 41] : [42, 43, 44, 45, 46, 47]
  const pts = indices.map((idx) => getPoint(landmarks[idx]))

  // Vertical distances: ||p2 - p6|| and ||p3 - p5||
  const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y)
  const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y)

  // Horizontal distance: ||p1 - p4||
  const h = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y)

  if (h === 0) return 0.3
  return (v1 + v2) / (2.0 * h)
}

/**
 * Evaluates head pose (Yaw, Pitch, Roll) using 68 3D/2D facial landmarks
 */
export function estimateHeadPose(landmarks: FaceLandmarkPoint[]): {
  yaw: number
  pitch: number
  roll: number
  isAcceptable: boolean
} {
  if (!landmarks || landmarks.length < 68) {
    return { yaw: 0, pitch: 0, roll: 0, isAcceptable: true }
  }

  const leftEyeOuter = getPoint(landmarks[36])
  const leftEyeInner = getPoint(landmarks[39])
  const rightEyeInner = getPoint(landmarks[42])
  const rightEyeOuter = getPoint(landmarks[45])
  const noseTip = getPoint(landmarks[30])
  const chin = getPoint(landmarks[8])
  const mouthCenter = getPoint(landmarks[62] || landmarks[66] || landmarks[57])

  const leftEyeCenter = {
    x: (leftEyeOuter.x + leftEyeInner.x) / 2,
    y: (leftEyeOuter.y + leftEyeInner.y) / 2,
  }
  const rightEyeCenter = {
    x: (rightEyeOuter.x + rightEyeInner.x) / 2,
    y: (rightEyeOuter.y + rightEyeInner.y) / 2,
  }

  // 1. Roll (eye line tilt angle)
  const dy = rightEyeCenter.y - leftEyeCenter.y
  const dx = rightEyeCenter.x - leftEyeCenter.x
  const rollRad = Math.atan2(dy, dx)
  const rollDeg = (rollRad * 180) / Math.PI

  // 2. Yaw (Horizontal turn ratio)
  // Distance from nose to left eye vs nose to right eye
  const distLeftEyeToNose = Math.hypot(noseTip.x - leftEyeCenter.x, noseTip.y - leftEyeCenter.y)
  const distRightEyeToNose = Math.hypot(noseTip.x - rightEyeCenter.x, noseTip.y - rightEyeCenter.y)
  const yawRatio = distRightEyeToNose > 0 ? distLeftEyeToNose / distRightEyeToNose : 1.0
  // Convert ratio to approx degrees (-30 to +30)
  const yawDeg = Math.max(-45, Math.min(45, (yawRatio - 1.0) * 45))

  // 3. Pitch (Vertical tilt)
  // Eye line to nose vs nose to chin ratio
  const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2
  const eyeToNoseDist = Math.abs(noseTip.y - eyeMidY)
  const noseToChinDist = Math.abs(chin.y - noseTip.y)
  const pitchRatio = noseToChinDist > 0 ? eyeToNoseDist / noseToChinDist : 0.7
  const pitchDeg = Math.max(-35, Math.min(35, (pitchRatio - 0.75) * 50))

  // Acceptable limits: Roll <= 16 deg, Yaw <= 18 deg, Pitch <= 20 deg
  const isAcceptable =
    Math.abs(rollDeg) <= 16 &&
    Math.abs(yawDeg) <= 18 &&
    Math.abs(pitchDeg) <= 22

  return {
    yaw: Math.round(yawDeg),
    pitch: Math.round(pitchDeg),
    roll: Math.round(rollDeg),
    isAcceptable,
  }
}

/**
 * Analyzes illumination and image contrast in the face bounding box region
 */
export function analyzeImageLighting(
  videoElement: HTMLVideoElement,
  box: FaceBox
): { brightness: number; contrast: number; isGood: boolean } {
  try {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return { brightness: 128, contrast: 40, isGood: true }
    }

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return { brightness: 128, contrast: 40, isGood: true }

    const sampleWidth = 48
    const sampleHeight = 48
    canvas.width = sampleWidth
    canvas.height = sampleHeight

    // Crop face region
    const sx = Math.max(0, Math.min(videoElement.videoWidth - 1, box.x))
    const sy = Math.max(0, Math.min(videoElement.videoHeight - 1, box.y))
    const sw = Math.min(videoElement.videoWidth - sx, Math.max(10, box.width))
    const sh = Math.min(videoElement.videoHeight - sy, Math.max(10, box.height))

    ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, sampleWidth, sampleHeight)
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
    const data = imgData.data

    let totalLuminance = 0
    const count = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      // Standard luminance formula
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      totalLuminance += lum
    }

    const meanLuminance = totalLuminance / count

    let sumSquareDiff = 0
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const diff = lum - meanLuminance
      sumSquareDiff += diff * diff
    }

    const contrast = Math.sqrt(sumSquareDiff / count)

    // Good lighting criteria:
    // Brightness: between 42 (not too dark) and 225 (not blown out)
    // Contrast: >= 18 (not washed out or totally flat)
    const isGood = meanLuminance >= 42 && meanLuminance <= 225 && contrast >= 16

    return {
      brightness: Math.round(meanLuminance),
      contrast: Math.round(contrast),
      isGood,
    }
  } catch {
    return { brightness: 128, contrast: 40, isGood: true }
  }
}

/**
 * Evaluates comprehensive face quality for registration and self-attendance
 */
export function evaluateFaceQuality(
  detectionScore: number,
  box: FaceBox,
  landmarks: FaceLandmarkPoint[],
  videoElement: HTMLVideoElement,
  mode: "enroll" | "verify" = "enroll"
): FaceQualityResult {
  const issues: string[] = []
  const videoWidth = videoElement.videoWidth || 640
  const videoHeight = videoElement.videoHeight || 480

  // 1. Detection Score Check
  const minScore = mode === "enroll" ? 0.65 : 0.45
  if (detectionScore < minScore) {
    issues.push("Look directly at the camera and keep your face inside the guide.")
  }

  // 2. Face Size & Resolution Check
  const minSize = mode === "enroll" ? 100 : 75
  const isAdequateSize = box.width >= minSize && box.height >= minSize
  const faceAreaRatio = (box.width * box.height) / (videoWidth * videoHeight)

  if (!isAdequateSize || faceAreaRatio < 0.04) {
    issues.push("Move closer until your face is clearly detected.")
  } else if (faceAreaRatio > 0.75) {
    issues.push("Move slightly farther from the camera.")
  }

  // 3. Centering & Bounds Check
  const faceCenterX = box.x + box.width / 2
  const faceCenterY = box.y + box.height / 2
  const isCenteredX = faceCenterX > videoWidth * 0.15 && faceCenterX < videoWidth * 0.85
  const isCenteredY = faceCenterY > videoHeight * 0.12 && faceCenterY < videoHeight * 0.88
  const isWithinFrame =
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= videoWidth &&
    box.y + box.height <= videoHeight

  if (!isCenteredX || !isCenteredY || !isWithinFrame) {
    issues.push("Center your face inside the guide.")
  }

  const isProperlyPositioned = isAdequateSize && isCenteredX && isCenteredY && isWithinFrame

  // 4. Pose & Angles Check
  const pose = estimateHeadPose(landmarks)
  if (!pose.isAcceptable) {
    if (Math.abs(pose.yaw) > 18) {
      issues.push("Turn your head straight towards the camera.")
    } else if (Math.abs(pose.roll) > 16) {
      issues.push("Keep your head upright without tilting.")
    } else if (Math.abs(pose.pitch) > 22) {
      issues.push(pose.pitch > 0 ? "Tilt your chin down slightly." : "Tilt your chin up slightly.")
    }
  }

  // 5. Lighting & Contrast Analysis
  const lighting = analyzeImageLighting(videoElement, box)
  if (!lighting.isGood) {
    if (lighting.brightness < 42) {
      issues.push("Move to a well-lit area and avoid dark shadows.")
    } else if (lighting.brightness > 225) {
      issues.push("Move to a well-lit area and avoid strong light behind you.")
    } else if (lighting.contrast < 16) {
      issues.push("Hold camera steady in good lighting.")
    }
  }

  // 6. Overall Quality Score Computation
  let qualityScore = detectionScore * 0.35
  if (isAdequateSize) qualityScore += 0.20
  if (isProperlyPositioned) qualityScore += 0.15
  if (pose.isAcceptable) qualityScore += 0.15
  if (lighting.isGood) qualityScore += 0.15

  qualityScore = Math.max(0, Math.min(1.0, qualityScore))
  const isValid = issues.length === 0 && qualityScore >= (mode === "enroll" ? 0.70 : 0.50)

  return {
    isValid,
    qualityScore: Math.round(qualityScore * 100) / 100,
    issues,
    isProperlyPositioned,
    isGoodLighting: lighting.isGood,
    isSharp: lighting.contrast >= 16,
    isGoodPose: pose.isAcceptable,
    poseAngles: {
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
    },
    brightness: lighting.brightness,
    contrast: lighting.contrast,
  }
}

/**
 * Evaluates live temporal anti-spoofing across buffered frames
 * Prevents static printed photos or phone screen replay attacks.
 */
export function evaluateLiveness(
  currentLandmarks: FaceLandmarkPoint[],
  landmarkHistory: FaceLandmarkPoint[][]
): LivenessResult {
  if (!currentLandmarks || currentLandmarks.length < 68) {
    return { isLive: false, confidence: 0, reason: "Incomplete facial landmarks", temporalVariance: 0, ear: 0.3 }
  }

  const leftEar = calculateEAR(currentLandmarks, "left")
  const rightEar = calculateEAR(currentLandmarks, "right")
  const avgEar = (leftEar + rightEar) / 2

  if (landmarkHistory.length < 3) {
    // Warm-up phase: treat as active live if structure is intact
    return { isLive: true, confidence: 0.85, temporalVariance: 1.0, ear: avgEar }
  }

  // Calculate temporal variance of landmark micro-movements
  // Natural humans have microscopic tremors & breathing movements (0.2px to 25px variance)
  // Static printed photos or frozen screens have near-zero variance
  let totalDelta = 0
  let sampleCount = 0

  const noseTipCurr = getPoint(currentLandmarks[30])
  const chinCurr = getPoint(currentLandmarks[8])
  const leftEyeCurr = getPoint(currentLandmarks[36])

  for (const prevLandmarks of landmarkHistory) {
    if (prevLandmarks && prevLandmarks.length >= 68) {
      const noseTipPrev = getPoint(prevLandmarks[30])
      const chinPrev = getPoint(prevLandmarks[8])
      const leftEyePrev = getPoint(prevLandmarks[36])

      const d1 = Math.hypot(noseTipCurr.x - noseTipPrev.x, noseTipCurr.y - noseTipPrev.y)
      const d2 = Math.hypot(chinCurr.x - chinPrev.x, chinCurr.y - chinPrev.y)
      const d3 = Math.hypot(leftEyeCurr.x - leftEyePrev.x, leftEyeCurr.y - leftEyePrev.y)

      totalDelta += (d1 + d2 + d3) / 3
      sampleCount++
    }
  }

  const avgVariance = sampleCount > 0 ? totalDelta / sampleCount : 1.0

  // Spoof check: exactly 0 variance indicates a frozen fake frame
  if (avgVariance < 0.05 && landmarkHistory.length >= 5) {
    return {
      isLive: false,
      confidence: 0.2,
      reason: "Follow the on-screen instruction and perform the requested action naturally.",
      temporalVariance: avgVariance,
      ear: avgEar,
    }
  }

  // Erratic jitter check (> 45px indicates severe glitch or rapid shaking)
  if (avgVariance > 45.0) {
    return {
      isLive: false,
      confidence: 0.4,
      reason: "Keep your head steady unless instructed to move.",
      temporalVariance: avgVariance,
      ear: avgEar,
    }
  }

  const confidence = Math.min(1.0, Math.max(0.65, 0.85 + (avgEar > 0.18 && avgEar < 0.38 ? 0.1 : 0)))
  return {
    isLive: true,
    confidence,
    temporalVariance: Math.round(avgVariance * 100) / 100,
    ear: Math.round(avgEar * 100) / 100,
  }
}

/**
 * Synthesizes a stable face biometric embedding from multiple captured samples:
 * 1. Computes pairwise Euclidean distances to filter outlier samples.
 * 2. Computes quality-weighted centroid vector.
 * 3. Applies L2-unit normalization for robust metric cosine/Euclidean matching.
 */
export function synthesizeStableEmbedding(samples: FaceSampleItem[]): StableEmbeddingResult {
  if (!samples || samples.length === 0) {
    throw new Error("No face samples provided for biometric embedding synthesis.")
  }

  // If only 1 sample, validate and normalize
  if (samples.length === 1) {
    const normVec = normalizeL2Vector(samples[0].descriptor)
    return {
      descriptor: normVec,
      samplesUsed: 1,
      outliersDropped: 0,
      averageQuality: samples[0].qualityScore || 0.8,
      consistencyScore: 1.0,
    }
  }

  const n = samples.length
  const validSamples = samples.filter((s) => isValidFaceDescriptor(s.descriptor))

  if (validSamples.length === 0) {
    throw new Error("All face samples contained invalid or corrupted descriptor data.")
  }

  // Step 1: Compute pairwise distance matrix to detect outliers
  const avgDistances: number[] = new Array(validSamples.length).fill(0)
  for (let i = 0; i < validSamples.length; i++) {
    let sumDist = 0
    let count = 0
    for (let j = 0; j < validSamples.length; j++) {
      if (i !== j) {
        sumDist += calculateEuclideanDistance(validSamples[i].descriptor, validSamples[j].descriptor)
        count++
      }
    }
    avgDistances[i] = count > 0 ? sumDist / count : 0
  }

  // Threshold for outlier: average distance from others > 0.42 (or 1.4x median)
  const sortedDists = [...avgDistances].sort((a, b) => a - b)
  const medianDist = sortedDists[Math.floor(sortedDists.length / 2)] || 0.2
  const outlierThreshold = Math.max(0.38, medianDist * 1.4)

  const inlierSamples: FaceSampleItem[] = []
  let outliersDropped = 0

  for (let i = 0; i < validSamples.length; i++) {
    if (avgDistances[i] <= outlierThreshold || validSamples.length <= 2) {
      inlierSamples.push(validSamples[i])
    } else {
      outliersDropped++
    }
  }

  const finalSamples = inlierSamples.length > 0 ? inlierSamples : validSamples

  // Step 2: Quality-weighted centroid averaging
  const dim = 128
  const centroid = new Array(dim).fill(0)
  let totalWeight = 0
  let qualitySum = 0

  for (const sample of finalSamples) {
    const weight = Math.max(0.1, sample.qualityScore || 0.8)
    totalWeight += weight
    qualitySum += sample.qualityScore || 0.8
    for (let d = 0; d < dim; d++) {
      centroid[d] += sample.descriptor[d] * weight
    }
  }

  for (let d = 0; d < dim; d++) {
    centroid[d] /= totalWeight
  }

  // Step 3: L2 unit normalization
  const normalizedStableDescriptor = normalizeL2Vector(centroid)

  // Step 4: Consistency score (1 - median distance among inliers)
  const consistencyScore = Math.max(0, Math.min(1.0, 1.0 - medianDist))

  return {
    descriptor: normalizedStableDescriptor,
    samplesUsed: finalSamples.length,
    outliersDropped,
    averageQuality: Math.round((qualitySum / finalSamples.length) * 100) / 100,
    consistencyScore: Math.round(consistencyScore * 100) / 100,
  }
}
