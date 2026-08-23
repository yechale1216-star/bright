"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Play,
  FlipHorizontal,
  User,
  ShieldCheck,
  XCircle,
  Sun,
  SunMedium,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Info,
  Users,
} from "lucide-react"
import {
  useFaceRecognition,
  FaceDetectionResult,
  FaceMatchResult,
  FaceSampleItem,
  synthesizeStableEmbedding,
} from "@/lib/hooks/use-face-recognition"
import { NativeBridge } from "@/lib/utils/native-bridge"
import { ImpactStyle } from "@capacitor/haptics"

export interface FaceVerificationCameraProps {
  mode: "enroll" | "verify"
  enrolledDescriptor?: number[] | null
  onVerified?: (result: { descriptor: number[]; confidence?: number; samplesCount?: number }) => void
  onFailed?: (error: string) => void
  onCancel?: () => void
}

export type ScanStatus =
  | "idle"
  | "initializing"
  | "detecting"
  | "analyzing"
  | "capturing"
  | "matched"
  | "mismatched"
  | "not_recognized"
  | "multiple_faces"
  | "no_enrolled"
  | "timeout"
  | "error"

export interface EnrollStepConfig {
  step: number
  key: string
  label: string
  shortName: string
  instruction: string
  prompt: string
  icon: "user" | "left" | "right" | "up" | "confirm"
}

export const ENROLL_STEPS: EnrollStepConfig[] = [
  {
    step: 1,
    key: "front",
    label: "Step 1 of 5: Front View",
    shortName: "Front",
    instruction: "Look directly at the camera with a natural expression.",
    prompt: "Look straight at the camera and keep your face inside the guide.",
    icon: "user",
  },
  {
    step: 2,
    key: "left",
    label: "Step 2 of 5: Slight Left",
    shortName: "Turn Left",
    instruction: "Turn your head slightly to your left.",
    prompt: "Turn your head slightly to the left for sample 2.",
    icon: "left",
  },
  {
    step: 3,
    key: "right",
    label: "Step 3 of 5: Slight Right",
    shortName: "Turn Right",
    instruction: "Turn your head slightly to your right.",
    prompt: "Turn your head slightly to the right for sample 3.",
    icon: "right",
  },
  {
    step: 4,
    key: "up",
    label: "Step 4 of 5: Tilt Up",
    shortName: "Tilt Up",
    instruction: "Tilt your chin slightly up.",
    prompt: "Tilt your chin slightly up for sample 4.",
    icon: "up",
  },
  {
    step: 5,
    key: "confirm",
    label: "Step 5 of 5: Final Check",
    shortName: "Hold Steady",
    instruction: "Look straight at the camera and hold steady.",
    prompt: "Look straight ahead to complete registration.",
    icon: "confirm",
  },
]

const REQUIRED_ENROLL_SAMPLES = 5
const MIN_SAMPLE_GAP_MS = 250
const CAMERA_INIT_TIMEOUT_MS = 25000 // 25s for hardware/permission setup
const ENROLL_TIMEOUT_MS = 120000 // 120s (2 minutes) for registration
const VERIFY_TIMEOUT_MS = 60000 // 60s for attendance
const SCAN_TIMEOUT_MS = 60000
const LOOP_INTERVAL_MS = 60
const SAMPLE_HOLD_TOLERANCE_MS = 750 // 0.75s alignment hold threshold

const STATE_CONFIG: Record<
  ScanStatus,
  { label: string; scanLineColor: string; frameColor: string; frameShadow: string; showScanLine: boolean }
> = {
  idle: {
    label: "Ready to scan — press Start Camera",
    scanLineColor: "rgba(147,51,234,0.4)",
    frameColor: "rgba(147,51,234,0.3)",
    frameShadow: "0 0 16px rgba(147,51,234,0.15)",
    showScanLine: false,
  },
  initializing: {
    label: "Starting camera…",
    scanLineColor: "rgba(147,51,234,0.6)",
    frameColor: "rgba(147,51,234,0.35)",
    frameShadow: "0 0 18px rgba(147,51,234,0.2)",
    showScanLine: false,
  },
  detecting: {
    label: "Look directly at the camera and keep your face inside the guide.",
    scanLineColor: "rgba(147,51,234,0.85)",
    frameColor: "rgba(147,51,234,0.5)",
    frameShadow: "0 0 22px rgba(147,51,234,0.3)",
    showScanLine: true,
  },
  analyzing: {
    label: "Verifying identity…",
    scanLineColor: "rgba(99,102,241,1)",
    frameColor: "rgba(99,102,241,0.75)",
    frameShadow: "0 0 28px rgba(99,102,241,0.45)",
    showScanLine: true,
  },
  capturing: {
    label: "Capturing biometric samples… Keep your head steady.",
    scanLineColor: "rgba(16,185,129,1)",
    frameColor: "rgba(16,185,129,0.8)",
    frameShadow: "0 0 32px rgba(16,185,129,0.5)",
    showScanLine: true,
  },
  matched: {
    label: "✓ Identity Verified",
    scanLineColor: "rgba(16,185,129,0.9)",
    frameColor: "rgba(16,185,129,0.7)",
    frameShadow: "0 0 40px rgba(16,185,129,0.55)",
    showScanLine: false,
  },
  mismatched: {
    label: "Face does not match.",
    scanLineColor: "rgba(239,68,68,0.9)",
    frameColor: "rgba(239,68,68,0.75)",
    frameShadow: "0 0 32px rgba(239,68,68,0.45)",
    showScanLine: false,
  },
  not_recognized: {
    label: "Look directly at the camera and keep your face inside the guide.",
    scanLineColor: "rgba(251,191,36,0.8)",
    frameColor: "rgba(251,191,36,0.5)",
    frameShadow: "0 0 22px rgba(251,191,36,0.3)",
    showScanLine: true,
  },
  multiple_faces: {
    label: "Only one person should be visible in the camera.",
    scanLineColor: "rgba(244,63,94,0.8)",
    frameColor: "rgba(244,63,94,0.5)",
    frameShadow: "0 0 22px rgba(244,63,94,0.3)",
    showScanLine: false,
  },
  no_enrolled: {
    label: "No registered face found for this account.",
    scanLineColor: "rgba(244,63,94,0.8)",
    frameColor: "rgba(244,63,94,0.5)",
    frameShadow: "0 0 22px rgba(244,63,94,0.3)",
    showScanLine: false,
  },
  timeout: {
    label: "Scanning timed out. Please position your face in good light and try again.",
    scanLineColor: "rgba(244,63,94,0.8)",
    frameColor: "rgba(244,63,94,0.5)",
    frameShadow: "0 0 22px rgba(244,63,94,0.3)",
    showScanLine: false,
  },
  error: {
    label: "Camera is unavailable. Please check camera permission and try again.",
    scanLineColor: "rgba(244,63,94,0.6)",
    frameColor: "rgba(244,63,94,0.4)",
    frameShadow: "0 0 18px rgba(244,63,94,0.2)",
    showScanLine: false,
  },
}

export function FaceVerificationCamera({
  mode,
  enrolledDescriptor,
  onVerified,
  onFailed,
  onCancel,
}: FaceVerificationCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frameContainerRef = useRef<HTMLDivElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const scanLineRef = useRef<HTMLDivElement | null>(null)
  const scanDirRef = useRef(1)
  const scanPosRef = useRef(0)

  // Camera & guidance state
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [activeGuidance, setActiveGuidance] = useState<string>("")
  const [guidanceIcon, setGuidanceIcon] = useState<string>("user")
  const [sampleCount, setSampleCount] = useState<number>(0)
  const [showGuide, setShowGuide] = useState(false)

  // Tracking quality & alignment
  const [isFaceAligned, setIsFaceAligned] = useState(false)

  // Lifecycle guards & timers
  const mountedRef = useRef(true)
  const isAnalyzingRef = useRef(false)
  const verificationLockedRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Multi-sample enrollment buffer & matching verification counters
  const sampleBufferRef = useRef<FaceSampleItem[]>([])
  const lastSampleTimeRef = useRef<number>(0)
  const sampleAlignmentStartRef = useRef<number>(0)
  const consecutiveMatchesRef = useRef<number>(0)
  const nonMatchFramesRef = useRef<number>(0)

  const {
    isModelsLoaded,
    loadModels,
    detectFaceFromVideo,
    verifyFaceMatch,
    resetLivenessHistory,
  } = useFaceRecognition()

  // Clean stop all camera stream tracks
  const stopCameraStream = useCallback(() => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current)
      loopTimeoutRef.current = null
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
      scanTimeoutRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {
        /* ignore */
      }
      videoRef.current.srcObject = null
    }
    setIsCameraReady(false)
    setIsFaceAligned(false)
    resetLivenessHistory()
  }, [resetLivenessHistory])

  // ─── Scanning line animation via rAF ───
  const runScanAnimation = useCallback(() => {
    const el = scanLineRef.current
    if (!el || !mountedRef.current) return

    const SPEED = 0.65
    scanPosRef.current += SPEED * scanDirRef.current
    if (scanPosRef.current >= 96) {
      scanPosRef.current = 96
      scanDirRef.current = -1
    }
    if (scanPosRef.current <= 4) {
      scanPosRef.current = 4
      scanDirRef.current = 1
    }

    el.style.top = `${scanPosRef.current}%`
    animFrameRef.current = requestAnimationFrame(runScanAnimation)
  }, [])

  const startScanAnimation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(runScanAnimation)
  }, [runScanAnimation])

  const stopScanAnimation = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  // Warm-up models in background
  useEffect(() => {
    loadModels()
  }, [loadModels])

  // Start/stop scan-line animation based on scan status
  useEffect(() => {
    const cfg = STATE_CONFIG[scanStatus]
    if (cfg?.showScanLine) {
      startScanAnimation()
    } else {
      stopScanAnimation()
    }
    return stopScanAnimation
  }, [scanStatus, startScanAnimation, stopScanAnimation])

  // ─── Camera startup triggered explicitly by Start / Try Again button ───
  const startCamera = useCallback(
    async (cameraFacing: "user" | "environment" = facingMode) => {
      if (!mountedRef.current) return
      setScanStatus("initializing")
      setIsCameraReady(false)
      setIsFaceAligned(false)
      setActiveGuidance(
        mode === "enroll"
          ? ENROLL_STEPS[0].prompt
          : "Look directly at the camera and keep your face inside the guide."
      )
      setGuidanceIcon("user")
      setSampleCount(0)
      sampleBufferRef.current = []
      lastSampleTimeRef.current = 0
      sampleAlignmentStartRef.current = 0
      consecutiveMatchesRef.current = 0
      nonMatchFramesRef.current = 0
      verificationLockedRef.current = false
      isAnalyzingRef.current = false

      stopCameraStream()

      let initTimedOut = false
      const initTimer = setTimeout(() => {
        initTimedOut = true
        if (mountedRef.current && !verificationLockedRef.current) {
          verificationLockedRef.current = true
          stopCameraStream()
          setScanStatus("error")
          setActiveGuidance("Camera is unavailable. Please check camera permission and try again.")
          setGuidanceIcon("error")
          onFailed?.("Camera is unavailable. Please check camera permission and try again.")
        }
      }, CAMERA_INIT_TIMEOUT_MS)

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })

        clearTimeout(initTimer)
        if (initTimedOut || !mountedRef.current) {
          mediaStream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = mediaStream

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          await videoRef.current.play().catch(() => { })
        }

        setIsCameraReady(true)
        setScanStatus("detecting")
        setActiveGuidance(
          mode === "enroll"
            ? ENROLL_STEPS[0].prompt
            : "Look directly at the camera and keep your face inside the guide."
        )
        setGuidanceIcon("user")

        // Start scanning timeout (30s)
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !verificationLockedRef.current) {
            verificationLockedRef.current = true
            stopCameraStream()
            setScanStatus("timeout")
            setActiveGuidance("Scanning timed out. Please position your face in good light and try again.")
            setGuidanceIcon("timeout")
          }
        }, SCAN_TIMEOUT_MS)
      } catch {
        clearTimeout(initTimer)
        if (!mountedRef.current) return
        verificationLockedRef.current = true
        stopCameraStream()
        setScanStatus("error")
        setActiveGuidance("Camera is unavailable. Please check camera permission and try again.")
        setGuidanceIcon("error")
        onFailed?.("Camera is unavailable. Please check camera permission and try again.")
      }
    },
    [facingMode, mode, onFailed, stopCameraStream]
  )

  const handleStopAndReset = () => {
    stopCameraStream()
    setScanStatus("idle")
    verificationLockedRef.current = false
    setSampleCount(0)
    sampleBufferRef.current = []
    setActiveGuidance("")
    setGuidanceIcon("user")
    setIsFaceAligned(false)
    consecutiveMatchesRef.current = 0
    nonMatchFramesRef.current = 0
  }

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopScanAnimation()
      stopCameraStream()
    }
  }, [stopScanAnimation, stopCameraStream])

  // ─── Real-Time Dynamic Guidance Evaluator ───
  const updateDynamicGuidance = useCallback(
    (detection: FaceDetectionResult, currentSampleIdx: number) => {
      // 1. Multiple Faces
      if (detection.multipleFaces) {
        setScanStatus("multiple_faces")
        setActiveGuidance("Only one person should be visible in the camera.")
        setGuidanceIcon("multiple")
        setIsFaceAligned(false)
        return false
      }

      // 2. No Face Detected
      if (!detection.detected || !detection.descriptor) {
        setScanStatus("detecting")
        setActiveGuidance("Look directly at the camera and keep your face inside the guide.")
        setGuidanceIcon("user")
        setIsFaceAligned(false)
        return false
      }

      // 3. Specific Quality Issues
      if (detection.qualityIssues && detection.qualityIssues.length > 0) {
        const primaryIssue = detection.qualityIssues[0]
        setScanStatus("not_recognized")
        setIsFaceAligned(false)

        if (primaryIssue.includes("well-lit") || primaryIssue.includes("dark")) {
          setActiveGuidance("Move to a well-lit area and avoid dark shadows.")
          setGuidanceIcon("sun")
        } else if (primaryIssue.includes("strong light") || primaryIssue.includes("behind")) {
          setActiveGuidance("Move to a well-lit area and avoid strong light behind you.")
          setGuidanceIcon("sun-dim")
        } else if (primaryIssue.includes("closer")) {
          setActiveGuidance("Move closer until your face is clearly detected.")
          setGuidanceIcon("zoom-in")
        } else if (primaryIssue.includes("farther") || primaryIssue.includes("back")) {
          setActiveGuidance("Move slightly farther from the camera.")
          setGuidanceIcon("zoom-out")
        } else if (primaryIssue.includes("guide") || primaryIssue.includes("Center")) {
          setActiveGuidance("Look directly at the camera and keep your face inside the guide.")
          setGuidanceIcon("center")
        } else if (primaryIssue.includes("Turn") || primaryIssue.includes("straight") || primaryIssue.includes("upright") || primaryIssue.includes("Tilt")) {
          setActiveGuidance(primaryIssue)
          setGuidanceIcon("turn")
        } else {
          setActiveGuidance(primaryIssue)
          setGuidanceIcon("user")
        }
        return false
      }

      // 4. Liveness Check
      if (!detection.isLive) {
        setScanStatus("not_recognized")
        setActiveGuidance("Follow the on-screen instruction and perform the requested action naturally.")
        setGuidanceIcon("sparkles")
        setIsFaceAligned(false)
        return false
      }

      // 5. Well-Aligned State
      setIsFaceAligned(true)

      if (mode === "enroll") {
        const step = ENROLL_STEPS[Math.min(currentSampleIdx, ENROLL_STEPS.length - 1)]
        setGuidanceIcon(step.icon)
      } else {
        setGuidanceIcon("user")
      }

      return true
    },
    [mode]
  )

  // ─── Sequential Frame Analysis ───
  const analyzeFrame = useCallback(async () => {
    if (
      !mountedRef.current ||
      verificationLockedRef.current ||
      isAnalyzingRef.current ||
      !videoRef.current ||
      !isModelsLoaded ||
      !isCameraReady ||
      scanStatus === "idle" ||
      scanStatus === "mismatched" ||
      scanStatus === "matched"
    ) {
      return
    }

    const vid = videoRef.current
    if (vid.videoWidth === 0 || vid.videoHeight === 0 || vid.readyState < 2) {
      if (!verificationLockedRef.current && mountedRef.current) {
        loopTimeoutRef.current = setTimeout(analyzeFrame, 60)
      }
      return
    }

    isAnalyzingRef.current = true

    try {
      const detection: FaceDetectionResult = await detectFaceFromVideo(vid, mode)

      if (!mountedRef.current || verificationLockedRef.current) return

      const currentSampleIdx = sampleBufferRef.current.length
      const isAligned = updateDynamicGuidance(detection, currentSampleIdx)

      if (!isAligned || !detection.descriptor) {
        sampleAlignmentStartRef.current = 0
        return
      }

      // ─── ENROLL MODE (Progressive Multi-Sample Registration) ───
      if (mode === "enroll") {
        const now = performance.now()

        if (sampleAlignmentStartRef.current === 0) {
          sampleAlignmentStartRef.current = now
        }

        const elapsedAlignment = now - sampleAlignmentStartRef.current
        const timeSinceLastSample = now - lastSampleTimeRef.current

        // Check if sample step condition is met
        const activeStep = ENROLL_STEPS[Math.min(currentSampleIdx, ENROLL_STEPS.length - 1)]
        const pose = detection.poseAngles || { yaw: 0, pitch: 0, roll: 0 }

        let isTargetAngleReached = true

        if (activeStep.key === "left") {
          isTargetAngleReached = pose.yaw <= -4 || elapsedAlignment >= 1200
          if (!isTargetAngleReached) {
            setActiveGuidance("Turn your head slightly to the left.")
            setGuidanceIcon("left")
          }
        } else if (activeStep.key === "right") {
          isTargetAngleReached = pose.yaw >= 4 || elapsedAlignment >= 1200
          if (!isTargetAngleReached) {
            setActiveGuidance("Turn your head slightly to the right.")
            setGuidanceIcon("right")
          }
        } else if (activeStep.key === "up") {
          isTargetAngleReached = pose.pitch <= -4 || elapsedAlignment >= 1200
          if (!isTargetAngleReached) {
            setActiveGuidance("Tilt your chin slightly up.")
            setGuidanceIcon("up")
          }
        }

        if (isTargetAngleReached && timeSinceLastSample >= MIN_SAMPLE_GAP_MS) {
          lastSampleTimeRef.current = now
          sampleAlignmentStartRef.current = 0

          sampleBufferRef.current.push({
            descriptor: detection.descriptor,
            qualityScore: detection.qualityScore,
            landmarks: detection.landmarks,
            timestamp: now,
          })

          const newCount = sampleBufferRef.current.length
          setSampleCount(newCount)
          setScanStatus("capturing")
          NativeBridge.vibrate(ImpactStyle.Light)

          if (newCount < REQUIRED_ENROLL_SAMPLES) {
            const nextStep = ENROLL_STEPS[newCount]
            setActiveGuidance(nextStep.prompt)
            setGuidanceIcon(nextStep.icon)
          } else {
            // All 5 samples captured successfully
            verificationLockedRef.current = true
            setScanStatus("matched")
            setActiveGuidance("✓ Face registration complete! Biometric profile securely created.")
            setGuidanceIcon("check")

            const stableResult = synthesizeStableEmbedding(sampleBufferRef.current)

            stopCameraStream()
            NativeBridge.vibrate(ImpactStyle.Medium)
            onVerified?.({
              descriptor: stableResult.descriptor,
              confidence: stableResult.consistencyScore,
              samplesCount: stableResult.samplesUsed,
            })
            return
          }
        } else if (isTargetAngleReached) {
          setActiveGuidance(`Keep your head steady — capturing sample ${currentSampleIdx + 1} of 5…`)
          setGuidanceIcon("camera")
        }

        return
      }

      // ─── VERIFY MODE (Fast Self-Attendance Verification) ───
      if (!enrolledDescriptor || !Array.isArray(enrolledDescriptor) || enrolledDescriptor.length !== 128) {
        verificationLockedRef.current = true
        stopCameraStream()
        setScanStatus("no_enrolled")
        setActiveGuidance("No registered face found for this account. Please contact school administration.")
        setGuidanceIcon("error")
        onFailed?.("Face biometric profile not registered for your account. Please enroll your face first.")
        return
      }

      setScanStatus("analyzing")
      const matchResult: FaceMatchResult = verifyFaceMatch(detection.descriptor, enrolledDescriptor)

      if (matchResult.isMatch && detection.isLive) {
        consecutiveMatchesRef.current++
        nonMatchFramesRef.current = 0

        // Require at least 2 consecutive passing frames to ensure temporal biometric stability
        if (consecutiveMatchesRef.current >= 2) {
          verificationLockedRef.current = true
          setScanStatus("matched")
          setActiveGuidance("✓ Identity verified successfully.")
          setGuidanceIcon("check")
          stopCameraStream()
          NativeBridge.vibrate(ImpactStyle.Light)
          onVerified?.({
            descriptor: detection.descriptor,
            confidence: matchResult.confidence,
          })
          return
        }
      } else {
        nonMatchFramesRef.current++
        consecutiveMatchesRef.current = 0

        // Allow up to 3 non-matching/noisy frames while detecting before firmly locking and failing
        if (nonMatchFramesRef.current >= 3) {
          verificationLockedRef.current = true
          stopCameraStream()
          setScanStatus("mismatched")
          setActiveGuidance("Face does not match your registered profile. Attendance was not recorded.")
          setGuidanceIcon("error")
          NativeBridge.vibrate(ImpactStyle.Heavy)
          onFailed?.("Face does not match your registered profile. Attendance was not recorded.")
          return
        }
      }
    } catch {
      // Continue next frame
    } finally {
      isAnalyzingRef.current = false
      if (mountedRef.current && !verificationLockedRef.current && isCameraReady) {
        loopTimeoutRef.current = setTimeout(analyzeFrame, LOOP_INTERVAL_MS)
      }
    }
  }, [
    isModelsLoaded,
    isCameraReady,
    scanStatus,
    detectFaceFromVideo,
    mode,
    enrolledDescriptor,
    verifyFaceMatch,
    onVerified,
    stopCameraStream,
    updateDynamicGuidance,
  ])

  // Trigger analysis loop
  useEffect(() => {
    if (
      !isCameraReady ||
      !isModelsLoaded ||
      verificationLockedRef.current ||
      scanStatus === "idle" ||
      scanStatus === "mismatched" ||
      scanStatus === "matched"
    ) {
      return
    }
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current)
    loopTimeoutRef.current = setTimeout(analyzeFrame, 40)
    return () => {
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current)
    }
  }, [isCameraReady, isModelsLoaded, scanStatus, analyzeFrame])

  const cfg = STATE_CONFIG[scanStatus] || STATE_CONFIG.idle
  const isFrontCamera = facingMode === "user"
  const isFailedState =
    scanStatus === "multiple_faces" ||
    scanStatus === "no_enrolled" ||
    scanStatus === "error" ||
    scanStatus === "timeout" ||
    scanStatus === "not_recognized" ||
    scanStatus === "mismatched"

  const renderGuidanceIcon = () => {
    switch (guidanceIcon) {
      case "sun":
        return <Sun className="w-4 h-4 text-amber-400 shrink-0" />
      case "sun-dim":
        return <SunMedium className="w-4 h-4 text-amber-400 shrink-0" />
      case "zoom-in":
        return <Maximize2 className="w-4 h-4 text-sky-400 shrink-0" />
      case "zoom-out":
        return <Minimize2 className="w-4 h-4 text-sky-400 shrink-0" />
      case "left":
        return <ArrowLeft className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
      case "right":
        return <ArrowRight className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
      case "up":
        return <ArrowUp className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
      case "sparkles":
        return <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
      case "multiple":
        return <Users className="w-4 h-4 text-rose-400 shrink-0" />
      case "camera":
        return <Camera className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
      case "check":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      case "error":
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
      default:
        return <User className="w-4 h-4 text-primary shrink-0" />
    }
  }

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center gap-3 select-none">
      {/* ─── 0. CAMERA SELECTION & ENROLLMENT STEPPER ─── */}
      {scanStatus === "idle" && (
        <div className="w-full flex items-center justify-between p-1.5 rounded-2xl bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setFacingMode("user")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${isFrontCamera
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Front Camera</span>
          </button>
          <button
            type="button"
            onClick={() => setFacingMode("environment")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${!isFrontCamera
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Back Camera</span>
          </button>
        </div>
      )}

      {/* ─── STEP PROGRESS BAR (ENROLL MODE) ─── */}
      {mode === "enroll" && (
        <div className="w-full bg-muted/40 p-2.5 rounded-2xl border border-border/50 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
            <span className="text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Biometric Registration</span>
            </span>
            <span className="text-primary font-mono">
              {sampleCount}/{REQUIRED_ENROLL_SAMPLES} Samples
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {ENROLL_STEPS.map((s, idx) => {
              const isDone = idx < sampleCount
              const isCurrent = idx === sampleCount && scanStatus !== "idle" && scanStatus !== "matched"
              return (
                <div
                  key={s.key}
                  className={`py-1 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center gap-0.5 ${isDone
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                      : isCurrent
                        ? "bg-primary/20 text-primary border border-primary/50 shadow-sm"
                        : "bg-muted/60 text-muted-foreground/60 border border-transparent"
                    }`}
                >
                  <span className="text-[10px] font-black leading-none">{s.step}</span>
                  <span className="text-[8px] font-semibold truncate max-w-full leading-none">
                    {s.shortName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── 1. CAMERA VIEWPORT ─── */}
      <div
        ref={frameContainerRef}
        className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-950 flex items-center justify-center"
        style={{
          height: 'min(55vh, 460px)',
          boxShadow: isFaceAligned
            ? "0 0 30px rgba(16,185,129,0.4)"
            : cfg.frameShadow,
          border: `2.5px solid ${isFaceAligned ? "rgba(16,185,129,0.85)" : cfg.frameColor}`,
          transition: "border-color 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        {/* Live video feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover ${isFrontCamera ? "-scale-x-100" : "scale-x-100"
            }`}
        />

        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65 pointer-events-none" />

        {/* ─── Center Oval Face Guide ─── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className={`w-[66%] h-[68%] rounded-[50%] border-2 transition-all duration-300 ${isFaceAligned
                ? "border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.6)]"
                : scanStatus === "capturing"
                  ? "border-primary shadow-[0_0_20px_rgba(147,51,234,0.5)]"
                  : isFailedState
                    ? "border-rose-400/80 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    : "border-white/40 border-dashed"
              }`}
          />
        </div>

        {/* ── Corner bracket markers ── */}
        <div className="absolute top-5 left-5 pointer-events-none" style={{ width: 24, height: 24 }}>
          <div className="absolute top-0 left-0 w-full h-[3px] rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
          <div className="absolute top-0 left-0 w-[3px] h-full rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
        </div>
        <div className="absolute top-5 right-5 pointer-events-none" style={{ width: 24, height: 24 }}>
          <div className="absolute top-0 right-0 w-full h-[3px] rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
          <div className="absolute top-0 right-0 w-[3px] h-full rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
        </div>
        <div className="absolute bottom-20 left-5 pointer-events-none" style={{ width: 24, height: 24 }}>
          <div className="absolute bottom-0 left-0 w-full h-[3px] rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
          <div className="absolute bottom-0 left-0 w-[3px] h-full rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
        </div>
        <div className="absolute bottom-20 right-5 pointer-events-none" style={{ width: 24, height: 24 }}>
          <div className="absolute bottom-0 right-0 w-full h-[3px] rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
          <div className="absolute bottom-0 right-0 w-[3px] h-full rounded-full" style={{ background: isFaceAligned ? "rgba(16,185,129,0.9)" : cfg.frameColor }} />
        </div>

        {/* ── PROMINENT START BUTTON & IDLE OVERLAY ── */}
        {scanStatus === "idle" && (
          <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shadow-lg text-primary">
              <Camera className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-white">
              {mode === "enroll" ? "Biometric Registration" : "Self-Attendance Scanner"}
            </h3>

            <Button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="h-12 px-6 rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-2 active:scale-95 transition-transform"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Camera</span>
            </Button>
          </div>
        )}

        {/* ── Initializing Loading Spinner ── */}
        {scanStatus === "initializing" && (
          <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center gap-3">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-semibold text-white">Starting camera…</p>
          </div>
        )}

        {/* ── Mismatch Overlay ── */}
        {scanStatus === "mismatched" && (
          <div className="relative z-20 flex flex-col items-center justify-center p-8 text-center gap-4 animate-in zoom-in-95 duration-200 w-full h-full">
            {/* MISMATCH badge — top left */}
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border border-rose-500/60 bg-black/80 text-rose-400 text-[10px] font-bold tracking-widest uppercase">
                MISMATCH
              </span>
            </div>

            {/* Glowing X icon */}
            <div
              className="w-16 h-16 rounded-full border-2 border-rose-500 flex items-center justify-center text-rose-500"
              style={{ boxShadow: "0 0 32px rgba(239,68,68,0.6)" }}
            >
              <XCircle className="w-9 h-9 stroke-[1.8]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-wide">Face does not match.</h3>
              <p className="text-xs text-rose-300/80 font-medium">Please try again.</p>
            </div>

            <Button
              type="button"
              onClick={() => {
                verificationLockedRef.current = false
                startCamera(facingMode)
              }}
              className="h-10 px-8 rounded-full font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-lg gap-2 active:scale-95 transition-transform border-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Try Again</span>
            </Button>
          </div>
        )}

        {/* ── Animated Real-Time Scan Line ── */}
        {cfg.showScanLine && (
          <div
            ref={scanLineRef}
            className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: "50%",
              height: 3,
              marginLeft: 20,
              marginRight: 20,
              background: `linear-gradient(90deg, transparent 0%, ${cfg.scanLineColor} 20%, #fff 50%, ${cfg.scanLineColor} 80%, transparent 100%)`,
              borderRadius: 4,
              filter: "blur(0.5px)",
              boxShadow: `0 0 10px 4px ${cfg.scanLineColor.replace(")", ", 0.4)").replace("rgba", "rgba")}, 0 0 2px 1px #fff`,
              willChange: "top",
            }}
          />
        )}

        {/* ── Success Ripple & Checkmark ── */}
        {scanStatus === "matched" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-24 h-24 rounded-full border-4 border-emerald-400/80 animate-ping" style={{ animationDuration: "0.8s" }} />
            <div className="absolute w-16 h-16 rounded-full bg-emerald-500/25 animate-ping" style={{ animationDuration: "0.6s" }} />
            <CheckCircle2 className="absolute w-12 h-12 text-emerald-400 drop-shadow-lg" style={{ filter: "drop-shadow(0 0 10px rgba(16,185,129,0.95))" }} />
          </div>
        )}

        {/* ── Top mode badge ── */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <Badge
            variant="outline"
            className="backdrop-blur-md px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase"
            style={{
              background: "rgba(0,0,0,0.75)",
              border: `1px solid ${isFaceAligned ? "rgba(16,185,129,0.7)" : cfg.frameColor}`,
              color:
                scanStatus === "matched"
                  ? "#6ee7b7"
                  : scanStatus === "mismatched"
                    ? "#fda4af"
                    : isFailedState
                      ? "#fca5a5"
                      : "#e2e8f0",
            }}
          >
            {mode === "enroll"
              ? `Sample ${sampleCount}/${REQUIRED_ENROLL_SAMPLES}`
              : scanStatus === "matched"
                ? "Verified"
                : scanStatus === "mismatched"
                  ? "Mismatch"
                  : "Face Scanner"}
          </Badge>
        </div>

        {/* ── DYNAMIC SINGLE INSTRUCTION PILL (INSIDE VIEWPORT) ── */}
        {scanStatus !== "mismatched" && scanStatus !== "idle" && (
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pointer-events-none z-20">
            <div
              className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 backdrop-blur-lg shadow-lg transition-all duration-200"
              style={{
                background: isFaceAligned
                  ? "rgba(16,185,129,0.92)"
                  : isFailedState
                    ? "rgba(225,29,72,0.90)"
                    : "rgba(15,23,42,0.92)",
                border: `1px solid ${isFaceAligned
                    ? "rgba(16,185,129,0.95)"
                    : isFailedState
                      ? "rgba(244,63,94,0.6)"
                      : "rgba(255,255,255,0.2)"
                  }`,
              }}
            >
              {renderGuidanceIcon()}

              <span className="text-xs font-bold leading-tight flex-1 text-white">
                {activeGuidance || cfg.label}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. BELOW-FRAME STATUS & ACTION BUTTONS ─── */}
      <div className="w-full flex items-center justify-between gap-2 pt-0.5">
        {/* Switch camera button */}
        {scanStatus !== "idle" && scanStatus !== "matched" && scanStatus !== "mismatched" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStopAndReset}
            className="text-xs gap-1.5 rounded-xl border-border/80"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Switch Camera</span>
          </Button>
        )}

        {/* Immediate retry button */}
        {(scanStatus === "error" || scanStatus === "timeout" || scanStatus === "not_recognized" || scanStatus === "mismatched") && (
          <Button
            type="button"
            variant={scanStatus === "mismatched" ? "destructive" : "default"}
            size="sm"
            onClick={() => {
              verificationLockedRef.current = false
              startCamera(facingMode)
            }}
            className="flex-1 gap-1.5 rounded-xl font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </Button>
        )}

        {/* Cancel button */}
        {onCancel && scanStatus !== "matched" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              stopCameraStream()
              onCancel()
            }}
            className="text-muted-foreground text-xs ml-auto rounded-xl hover:bg-muted/60"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* ─── 3. GUIDE BUTTON ─── */}
      <div className="w-full flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-xl hover:bg-muted/50"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Guide</span>
        </button>
      </div>

      {/* ─── Guide Popup Dialog ─── */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Info className="w-4 h-4 text-primary" />
              Registration Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 text-sm text-muted-foreground mt-1">
            <div className="flex items-start gap-2.5">
              <Sun className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Good lighting: </span>
                Move to a well-lit area. Avoid strong light or windows directly behind you.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Face centered: </span>
                Look directly at the camera and keep your face inside the oval guide.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Maximize2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Correct distance: </span>
                Move closer or farther until your face fills the guide clearly.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">One face only: </span>
                Only one person should be visible in the camera at a time.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Follow prompts: </span>
                Complete all 5 poses — Front, Turn Left, Turn Right, Tilt Up, Hold Steady.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Stay steady: </span>
                Hold each pose briefly so the camera captures a clean sample.
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
