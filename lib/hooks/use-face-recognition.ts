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

export const DEFAULT_MATCH_THRESHOLD = 0.50 // Strict threshold for face descriptor matching
export const FAST_SELF_ATTENDANCE_THRESHOLD = 0.52 // Calibrated for fast self-attendance to eliminate false rejects while remaining secure

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

  // Temporal landmark buffer for live anti-spoofing verification
  const landmarkHistoryRef = useRef<FaceLandmarkPoint[][]>([])

  const resetLivenessHistory = useCallback(() => {
    landmarkHistoryRef.current = []
  }, [])

  const loadModels = useCallback(async (timeoutMs = 12000) => {
    if (globalModelsLoaded) {
      setIsModelsLoaded(true)
      faceApiRef.current = globalFaceApi
      return
    }

    if (globalModelsPromise) {
      setIsLoadingModels(true)
      try {
        await globalModelsPromise
        setIsModelsLoaded(true)
        faceApiRef.current = globalFaceApi
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

        // Ultra-fast TinyFaceDetector options (inputSize: 320 is optimized for speed & accuracy)
        const detectorOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: mode === "enroll" ? 0.45 : 0.38,
        })

        // Step 1: Detect all faces, landmarks, and descriptors
        const detections = await faceapi
          .detectAllFaces(videoElement, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptors()

        const inferenceTimeMs = Math.round(performance.now() - startTime)

        if (!detections || detections.length === 0) {
          // Clear liveness history when face leaves frame
          landmarkHistoryRef.current = []
          return {
            detected: false,
            descriptor: null,
            multipleFaces: false,
            qualityScore: 0,
            inferenceTimeMs,
          }
        }

        if (detections.length > 1) {
          landmarkHistoryRef.current = []
          return {
            detected: true,
            descriptor: null,
            multipleFaces: true,
            qualityScore: 0,
            qualityIssues: ["Multiple faces detected. Please ensure only one person is in the frame."],
            error: "Multiple faces detected. Please ensure only one person is in the frame.",
            inferenceTimeMs,
          }
        }

        const primaryDetection = detections[0]
        const rawDescriptor = Array.from(primaryDetection.descriptor) as number[]
        // L2 normalize descriptor for strict metric stability
        const descriptorArray = normalizeL2Vector(rawDescriptor)
        const score = primaryDetection.detection.score
        const box = primaryDetection.detection.box
        const landmarksObj = primaryDetection.landmarks
        const landmarksList: FaceLandmarkPoint[] = (landmarksObj?.positions || []).map((p: any) => ({
          x: p.x,
          y: p.y,
          _x: p._x ?? p.x,
          _y: p._y ?? p.y,
        }))

        // Step 2: Comprehensive Quality Evaluation
        const quality = evaluateFaceQuality(
          score,
          {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
          landmarksList,
          videoElement,
          mode
        )

        // Step 3: Anti-Spoofing & Liveness Evaluation
        const liveness = evaluateLiveness(landmarksList, landmarkHistoryRef.current)

        // Update landmark history buffer (keep last 8 frames)
        if (landmarksList.length === 68) {
          landmarkHistoryRef.current.push(landmarksList)
          if (landmarkHistoryRef.current.length > 8) {
            landmarkHistoryRef.current.shift()
          }
        }

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
      // Normalize both vectors to guarantee unit metric calculations
      const normLive = normalizeL2Vector(liveDescriptor)
      const normEnrolled = normalizeL2Vector(enrolledDescriptor)

      const distance = calculateEuclideanDistance(normLive, normEnrolled)
      const cosineSim = calculateCosineSimilarity(normLive, normEnrolled)
      const isMatch = distance <= threshold || cosineSim >= (1.0 - threshold * 0.75)
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
