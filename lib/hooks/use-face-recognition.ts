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

const DEFAULT_MATCH_THRESHOLD = 0.50 // Standard threshold for face descriptor matching

export function useFaceRecognition() {
  const [isModelsLoaded, setIsModelsLoaded] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const faceApiRef = useRef<any>(null)

  const loadModels = useCallback(async () => {
    if (isModelsLoaded || isLoadingModels) return
    setIsLoadingModels(true)
    setLoadError(null)

    try {
      // Dynamic import to avoid SSR issues
      const faceapi = await import("@vladmandic/face-api")
      faceApiRef.current = faceapi

      const localModelPath = "/models"
      const cdnModelPath = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

      // Try local models first, fallback to CDN if not available
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(localModelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(localModelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(localModelPath),
        ])
      } catch (localErr) {
        console.warn("[FaceRecognition] Local models not found, attempting CDN load:", localErr)
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(cdnModelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(cdnModelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(cdnModelPath),
        ])
      }

      setIsModelsLoaded(true)
    } catch (err: any) {
      console.error("[FaceRecognition] Failed to load face models:", err)
      setLoadError(err.message || "Failed to load face recognition models")
    } finally {
      setIsLoadingModels(false)
    }
  }, [isModelsLoaded, isLoadingModels])

  const detectFaceFromVideo = useCallback(
    async (videoElement: HTMLVideoElement): Promise<FaceDetectionResult> => {
      if (!faceApiRef.current || !isModelsLoaded) {
        return {
          detected: false,
          descriptor: null,
          multipleFaces: false,
          qualityScore: 0,
          error: "Face recognition models not loaded yet",
        }
      }

      try {
        const faceapi = faceApiRef.current

        // Detect all faces with landmarks and descriptors
        // minConfidence 0.45 catches faces faster on lower-end devices
        const detections = await faceapi
          .detectAllFaces(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 }))
          .withFaceLandmarks()
          .withFaceDescriptors()

        if (!detections || detections.length === 0) {
          return {
            detected: false,
            descriptor: null,
            multipleFaces: false,
            qualityScore: 0,
          }
        }

        if (detections.length > 1) {
          return {
            detected: true,
            descriptor: null,
            multipleFaces: true,
            qualityScore: 0,
            error: "Multiple faces detected. Please ensure only one person is in the frame.",
          }
        }

        const primaryDetection = detections[0]
        const descriptorArray = Array.from(primaryDetection.descriptor) as number[]
        const score = primaryDetection.detection.score
        const box = primaryDetection.detection.box
        const landmarks = primaryDetection.landmarks

        // Basic liveness / anti-spoof checks:
        // 1. Adequate detector score (>= 0.50 — permissive for speed on low-end devices)
        // 2. Minimum face resolution (box width/height >= 60px)
        // 3. Complete 68-point 3D facial landmark mesh
        const hasLandmarks = landmarks && landmarks.positions && landmarks.positions.length === 68
        const isAdequateSize = box.width >= 60 && box.height >= 60
        const isLive = score >= 0.50 && hasLandmarks && isAdequateSize

        // Check if face is properly centered within the video frame
        const videoWidth = videoElement.videoWidth || 640
        const videoHeight = videoElement.videoHeight || 480
        const faceCenterX = box.x + box.width / 2
        const faceCenterY = box.y + box.height / 2
        // Slightly wider acceptance zone — avoids false "not positioned" on mobile
        const isCenteredX = faceCenterX > videoWidth * 0.12 && faceCenterX < videoWidth * 0.88
        const isCenteredY = faceCenterY > videoHeight * 0.10 && faceCenterY < videoHeight * 0.90
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
        }
      } catch (err: any) {
        console.error("[FaceRecognition] Detection error:", err)
        return {
          detected: false,
          descriptor: null,
          multipleFaces: false,
          qualityScore: 0,
          error: err.message || "Face detection failed",
        }
      }
    },
    [isModelsLoaded]
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
