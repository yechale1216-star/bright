"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  calculateEuclideanDistance,
  calculateCosineSimilarity,
  calculateL2Norm,
  normalizeL2Vector,
  isValidFaceDescriptor,
  evaluateFaceQuality,
  evaluateLiveness,
  synthesizeStableEmbedding,
  FaceLandmarkPoint,
  FaceQualityResult,
  LivenessResult,
  FaceSampleItem,
  StableEmbeddingResult,
} from "@/lib/utils/biometric-quality"

export {
  calculateEuclideanDistance,
  calculateCosineSimilarity,
  calculateL2Norm,
  normalizeL2Vector,
  isValidFaceDescriptor,
  evaluateFaceQuality,
  evaluateLiveness,
  synthesizeStableEmbedding,
}

export type { FaceLandmarkPoint, FaceQualityResult, LivenessResult, FaceSampleItem, StableEmbeddingResult }

export interface FaceDetectionResult {
  detected: boolean
  descriptor: number[] | null
  multipleFaces: boolean
  qualityScore: number
  qualityIssues?: string[]
  box?: { x: number; y: number; width: number; height: number }
  landmarks?: FaceLandmarkPoint[]
  isProperlyPositioned?: boolean
  isGoodLighting?: boolean
  isGoodPose?: boolean
  isSharp?: boolean
  poseAngles?: { yaw: number; pitch: number; roll: number }
  isLive?: boolean
  livenessConfidence?: number
  error?: string
  inferenceTimeMs?: number
}

export interface FaceMatchResult {
  isMatch: boolean
  distance: number
  confidence: number // 0.0 to 1.0 (1 - distance)
  similarityScore: number // Cosine similarity
}

export const DEFAULT_MATCH_THRESHOLD = 0.40 // Strict threshold for face descriptor matching
export const FAST_SELF_ATTENDANCE_THRESHOLD = 0.38 // Calibrated for high security: strictly rejects other people while reliably matching enrolled staff member
export const MIN_COSINE_SIMILARITY = 0.90 // Strict cosine similarity minimum for 1:1 biometric identity match

// Module-level singletons for model caching across hook instances
let globalFaceApi: any = null
let globalModelsPromise: Promise<void> | null = null
let globalModelsLoaded = false
let globalLoadError: string | null = null

export function useFaceRecognition() {
  const [isModelsLoaded, setIsModelsLoaded] = useState(globalModelsLoaded)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(globalLoadError)

  const faceApiRef = useRef<any>(globalFaceApi)
  const landmarkHistoryRef = useRef<FaceLandmarkPoint[][]>([])

  const resetLivenessHistory = useCallback(() => {
    landmarkHistoryRef.current = []
  }, [])

  const loadModels = useCallback(async (timeoutMs = 15000) => {
    if (globalModelsLoaded) {
      setIsModelsLoaded(true)
      return
    }

    if (globalModelsPromise) {
      setIsLoadingModels(true)
      try {
        await globalModelsPromise
        setIsModelsLoaded(true)
      } catch (err: any) {
        setLoadError(err.message || "Failed to load models")
      } finally {
        setIsLoadingModels(false)
      }
      return
    }

    setIsLoadingModels(true)
    setLoadError(null)

    globalModelsPromise = (async () => {
      // Dynamic import to avoid SSR issues
      const faceapi = await import("@vladmandic/face-api")
      globalFaceApi = faceapi
      faceApiRef.current = faceapi

      const localModelPath = "/models"
      const cdnModelPath = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

      // Helper with timeout
      const loadWithTimeout = async (fn: () => Promise<any>, timeoutLimit: number) => {
        let timer: any
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Model loading timed out after ${timeoutLimit}ms`)), timeoutLimit)
        })
        try {
          const res = await Promise.race([fn(), timeoutPromise])
          clearTimeout(timer)
          return res
        } catch (e) {
          clearTimeout(timer)
          throw e
        }
      }

      // Load TinyFaceDetector, landmark and recognition models
      // TinyFaceDetector is ~190KB (vs 5.6MB SsdMobilenet) and 10x-20x faster on mobile
      try {
        await loadWithTimeout(
          () =>
            Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(localModelPath),
              faceapi.nets.faceLandmark68Net.loadFromUri(localModelPath),
              faceapi.nets.faceRecognitionNet.loadFromUri(localModelPath),
            ]),
          timeoutMs
        )
      } catch (localErr) {
        console.warn("[FaceRecognition] Local models not found or timed out, attempting CDN fallback:", localErr)
        await loadWithTimeout(
          () =>
            Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(cdnModelPath),
              faceapi.nets.faceLandmark68Net.loadFromUri(cdnModelPath),
              faceapi.nets.faceRecognitionNet.loadFromUri(cdnModelPath),
            ]),
          timeoutMs
        )
      }

      globalModelsLoaded = true
      globalLoadError = null
    })()

    try {
      await globalModelsPromise
      setIsModelsLoaded(true)
    } catch (err: any) {
      console.error("[FaceRecognition] Failed to load face models:", err)
      const errorMsg = err.message || "Failed to load face recognition models"
      globalLoadError = errorMsg
      globalModelsPromise = null
      setLoadError(errorMsg)
    } finally {
      setIsLoadingModels(false)
    }
  }, [])

  // Auto-sync local state with singleton status
  useEffect(() => {
    if (globalModelsLoaded && !isModelsLoaded) {
      setIsModelsLoaded(true)
      faceApiRef.current = globalFaceApi
    }
  }, [isModelsLoaded])

  const detectFaceFromVideo = useCallback(
    async (
      videoElement: HTMLVideoElement,
      mode: "enroll" | "verify" = "verify"
    ): Promise<FaceDetectionResult> => {
      if (!faceApiRef.current || !globalModelsLoaded) {
        return {
          detected: false,
          descriptor: null,
          multipleFaces: false,
          qualityScore: 0,
          error: "Face recognition models not loaded yet",
        }
      }

      const startTime = performance.now()

      try {
        const faceapi = faceApiRef.current

        // 1. Configure detector options
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320, // 320x320 for optimal mobile speed and accuracy
          scoreThreshold: 0.50, // Strict detection confidence
        })

        // 2. Multi-face check to prevent attendance spoofing by another person in frame
        const allFaces = await faceapi.detectAllFaces(videoElement, options)
        if (allFaces.length > 1) {
          return {
            detected: true,
            descriptor: null,
            multipleFaces: true,
            qualityScore: 0,
            error: "Multiple faces detected. Ensure only one face is visible.",
            inferenceTimeMs: Math.round(performance.now() - startTime),
          }
        }

        // 3. Single face detection with 68 landmarks & 128-d descriptor
        const singleResult = await faceapi
          .detectSingleFace(videoElement, options)
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!singleResult) {
          return {
            detected: false,
            descriptor: null,
            multipleFaces: false,
            qualityScore: 0,
            error: "No face detected",
            inferenceTimeMs: Math.round(performance.now() - startTime),
          }
        }

        const box = singleResult.detection.box
        const landmarksList: FaceLandmarkPoint[] = singleResult.landmarks.positions.map((p: any) => ({
          x: p.x,
          y: p.y,
          _x: p._x,
          _y: p._y,
        }))

        // Convert descriptor Float32Array to standard number array
        const descriptorArray: number[] = Array.from(singleResult.descriptor as Float32Array)

        // 4. Quality checks (lighting, pose, box size, frame margins)
        const quality: FaceQualityResult = evaluateFaceQuality(
          singleResult.detection.score,
          box,
          landmarksList,
          videoElement,
          mode
        )

        // 5. Temporal anti-spoof liveness check
        if (landmarksList.length === 68) {
          landmarkHistoryRef.current.push(landmarksList)
          if (landmarkHistoryRef.current.length > 8) {
            landmarkHistoryRef.current.shift()
          }
        }
        const liveness: LivenessResult = evaluateLiveness(landmarksList, landmarkHistoryRef.current)

        const inferenceTimeMs = Math.round(performance.now() - startTime)

        return {
          detected: true,
          descriptor: descriptorArray,
          multipleFaces: false,
          qualityScore: quality.qualityScore,
          qualityIssues: quality.issues,
          box: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
          landmarks: landmarksList,
          isProperlyPositioned: quality.isProperlyPositioned,
          isGoodLighting: quality.isGoodLighting,
          isGoodPose: quality.isGoodPose,
          isSharp: quality.isSharp,
          poseAngles: quality.poseAngles,
          isLive: liveness.isLive && quality.isValid,
          livenessConfidence: liveness.confidence,
          inferenceTimeMs,
        }
      } catch (err: any) {
        console.error("[FaceRecognition] Detection error:", err)
        return {
          detected: false,
          descriptor: null,
          multipleFaces: false,
          qualityScore: 0,
          error: err.message || "Face detection failed",
          inferenceTimeMs: Math.round(performance.now() - startTime),
        }
      }
    },
    []
  )

  const verifyFaceMatch = useCallback(
    (
      liveDescriptor: number[],
      enrolledDescriptor: number[],
      threshold = FAST_SELF_ATTENDANCE_THRESHOLD
    ): FaceMatchResult => {
      // Validate both descriptors are 128-dimensional finite float arrays
      if (!isValidFaceDescriptor(liveDescriptor) || !isValidFaceDescriptor(enrolledDescriptor)) {
        return {
          isMatch: false,
          distance: 1.0,
          confidence: 0,
          similarityScore: 0,
        }
      }

      // Normalize both vectors to guarantee unit metric calculations
      const normLive = normalizeL2Vector(liveDescriptor)
      const normEnrolled = normalizeL2Vector(enrolledDescriptor)

      const distance = calculateEuclideanDistance(normLive, normEnrolled)
      const cosineSim = calculateCosineSimilarity(normLive, normEnrolled)
      
      // Strict dual verification:
      // Euclidean distance must be <= threshold (0.38) AND Cosine Similarity must be >= 0.90
      // This strictly prevents other people/impostors from being accepted.
      const isMatch = distance <= threshold && cosineSim >= MIN_COSINE_SIMILARITY
      const confidence = Math.max(0, Math.min(1, 1 - distance))

      return {
        isMatch,
        distance: Math.round(distance * 1000) / 1000,
        confidence: Math.round(confidence * 1000) / 1000,
        similarityScore: Math.round(cosineSim * 1000) / 1000,
      }
    },
    []
  )

  return {
    isModelsLoaded,
    isLoadingModels,
    loadError,
    loadModels,
    detectFaceFromVideo,
    verifyFaceMatch,
    resetLivenessHistory,
  }
}
