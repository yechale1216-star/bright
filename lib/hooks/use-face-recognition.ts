"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export interface FaceDetectionResult {
  detected: boolean
  descriptor: number[] | null
  multipleFaces: boolean
  qualityScore: number
  box?: { x: number; y: number; width: number; height: number }
  isProperlyPositioned?: boolean
  isLive?: boolean
  error?: string
  inferenceTimeMs?: number
}

export interface FaceMatchResult {
  isMatch: boolean
  distance: number
  confidence: number // 0.0 to 1.0 (1 - distance)
}

/**
 * Calculates Euclidean distance between two 128-dimensional descriptors
 */
export function calculateEuclideanDistance(desc1: number[], desc2: number[]): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 1.0
  let sum = 0
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

export const DEFAULT_MATCH_THRESHOLD = 0.50 // Standard strict threshold for face descriptor matching

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
    async (videoElement: HTMLVideoElement): Promise<FaceDetectionResult> => {
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
          scoreThreshold: 0.40,
        })

        // Step 1: Detect all faces and landmarks
        const detections = await faceapi
          .detectAllFaces(videoElement, detectorOptions)
          .withFaceLandmarks()
          .withFaceDescriptors()

        const inferenceTimeMs = Math.round(performance.now() - startTime)

        if (!detections || detections.length === 0) {
          return {
            detected: false,
            descriptor: null,
            multipleFaces: false,
            qualityScore: 0,
            inferenceTimeMs,
          }
        }

        if (detections.length > 1) {
          return {
            detected: true,
            descriptor: null,
            multipleFaces: true,
            qualityScore: 0,
            error: "Multiple faces detected. Please ensure only one person is in the frame.",
            inferenceTimeMs,
          }
        }

        const primaryDetection = detections[0]
        const descriptorArray = Array.from(primaryDetection.descriptor) as number[]
        const score = primaryDetection.detection.score
        const box = primaryDetection.detection.box
        const landmarks = primaryDetection.landmarks

        // Quality & liveness checks:
        // 1. Adequate detector score (>= 0.45)
        // 2. Minimum face resolution (box width/height >= 50px)
        // 3. Complete 68-point 3D facial landmark mesh
        const hasLandmarks = !!(landmarks && landmarks.positions && landmarks.positions.length === 68)
        const isAdequateSize = box.width >= 50 && box.height >= 50
        const isLive = score >= 0.45 && hasLandmarks && isAdequateSize

        // Center positioning check
        const videoWidth = videoElement.videoWidth || 640
        const videoHeight = videoElement.videoHeight || 480
        const faceCenterX = box.x + box.width / 2
        const faceCenterY = box.y + box.height / 2
        const isCenteredX = faceCenterX > videoWidth * 0.10 && faceCenterX < videoWidth * 0.90
        const isCenteredY = faceCenterY > videoHeight * 0.08 && faceCenterY < videoHeight * 0.92
        const isProperlyPositioned = isCenteredX && isCenteredY && isAdequateSize

        return {
          detected: true,
          descriptor: descriptorArray,
          multipleFaces: false,
          qualityScore: score,
          isLive,
          isProperlyPositioned,
          box: {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
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
    (liveDescriptor: number[], enrolledDescriptor: number[], threshold = DEFAULT_MATCH_THRESHOLD): FaceMatchResult => {
      const distance = calculateEuclideanDistance(liveDescriptor, enrolledDescriptor)
      const isMatch = distance <= threshold
      const confidence = Math.max(0, Math.min(1, 1 - distance))
      return { isMatch, distance, confidence }
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
  }
}

