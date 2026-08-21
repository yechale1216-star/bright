"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  ShieldAlert,
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
  | "not_recognized"
  | "multiple_faces"
  | "no_enrolled"
  | "timeout"
  | "error"

const REQUIRED_ENROLL_SAMPLES = 5
const MIN_SAMPLE_GAP_MS = 180

// User-friendly status labels without exposing technical details or thresholds
const STATE_CONFIG: Record<
  ScanStatus,
  { label: string; scanLineColor: string; frameColor: string; frameShadow: string; showScanLine: boolean }
> = {
  idle: {
    label: "Ready to scan — press Start Camera",
    scanLineColor: "rgba(147,51,234,0.4)",
    frameColor: "rgba(147,51,234,0.25)",
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
    label: "No face detected. Please look at the camera.",
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
    label: "Capturing biometric samples…",
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
  not_recognized: {
    label: "Face not recognized. Please try again.",
    scanLineColor: "rgba(251,191,36,0.8)",
    frameColor: "rgba(251,191,36,0.5)",
    frameShadow: "0 0 22px rgba(251,191,36,0.3)",
    showScanLine: true,
  },
  multiple_faces: {
    label: "Please make sure only your face is visible.",
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
    label: "Face not recognized. Please position your face clearly in the camera and try again.",
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

const CAMERA_INIT_TIMEOUT_MS = 8000
const SCAN_TIMEOUT_MS = 25000
const LOOP_INTERVAL_MS = 75

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
  const scanDirRef = useRef(1) // 1 = down, -1 = up
  const scanPosRef = useRef(0) // 0..100 percent

  // Camera setup & start control state
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [activeGuidance, setActiveGuidance] = useState<string>("")
  const [sampleCount, setSampleCount] = useState<number>(0)

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
      videoRef.current.srcObject = null
    }
    setIsCameraReady(false)
    resetLivenessHistory()
  }, [resetLivenessHistory])

  // ─── Scanning line animation via rAF ───
  const runScanAnimation = useCallback(() => {
    const el = scanLineRef.current
    if (!el || !mountedRef.current) return

    const SPEED = 0.55
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

  // ─── Camera startup triggered explicitly by Start button ───
  const startCamera = useCallback(
    async (cameraFacing: "user" | "environment" = facingMode) => {
      if (!mountedRef.current) return
      setScanStatus("initializing")
      setIsCameraReady(false)
      setActiveGuidance("")
      setSampleCount(0)
      sampleBufferRef.current = []
      lastSampleTimeRef.current = 0
      consecutiveMatchesRef.current = 0
      nonMatchFramesRef.current = 0
      verificationLockedRef.current = false
      isAnalyzingRef.current = false

      stopCameraStream()

      let initTimedOut = false
      const initTimer = setTimeout(() => {
        initTimedOut = true
        if (mountedRef.current && !verificationLockedRef.current) {
          setScanStatus("error")
          setActiveGuidance("Camera is unavailable. Please check camera permission and try again.")
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
          await videoRef.current.play().catch(() => {})
        }

        setIsCameraReady(true)
        setScanStatus("detecting")
        setActiveGuidance("No face detected. Please look at the camera.")

        // Start overall scanning timeout (25s)
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !verificationLockedRef.current) {
            setScanStatus("timeout")
            setActiveGuidance("Face not recognized. Please position your face clearly in the camera and try again.")
          }
        }, SCAN_TIMEOUT_MS)
      } catch {
        clearTimeout(initTimer)
        if (!mountedRef.current) return
        setScanStatus("error")
        setActiveGuidance("Camera is unavailable. Please check camera permission and try again.")
        onFailed?.("Camera is unavailable. Please check camera permission and try again.")
      }
    },
    [facingMode, onFailed, stopCameraStream]
  )

  const handleStopAndReset = () => {
    stopCameraStream()
    setScanStatus("idle")
    verificationLockedRef.current = false
    setSampleCount(0)
    sampleBufferRef.current = []
    setActiveGuidance("")
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

  // ─── Sequential Frame Analysis ───
  const analyzeFrame = useCallback(async () => {
    if (
      !mountedRef.current ||
      verificationLockedRef.current ||
      isAnalyzingRef.current ||
      !videoRef.current ||
      !isModelsLoaded ||
      !isCameraReady ||
      scanStatus === "idle"
    ) {
      return
    }

    const vid = videoRef.current
    if (vid.videoWidth === 0 || vid.videoHeight === 0 || vid.readyState < 2) {
      if (!verificationLockedRef.current && mountedRef.current) {
        loopTimeoutRef.current = setTimeout(analyzeFrame, 75)
      }
      return
    }

    isAnalyzingRef.current = true

    try {
      const detection: FaceDetectionResult = await detectFaceFromVideo(vid, mode)

      if (!mountedRef.current || verificationLockedRef.current) return

      // Failure Type 1: Multiple faces detected
      if (detection.multipleFaces) {
        setScanStatus("multiple_faces")
        setActiveGuidance("Please make sure only your face is visible.")
        return
      }

      // Failure Type 2: No face detected
      if (!detection.detected || !detection.descriptor) {
        setScanStatus("detecting")
        setActiveGuidance("No face detected. Please look at the camera.")
        return
      }

      // Failure Type 3: Poor image quality (lighting / blur / off-angle)
      if (detection.qualityIssues && detection.qualityIssues.length > 0) {
        setScanStatus("not_recognized")
        setActiveGuidance("Please improve the lighting and position your face clearly.")
        return
      }

      // Failure Type 4: Anti-spoof / Liveness failed
      if (!detection.isLive) {
        setScanStatus("not_recognized")
        setActiveGuidance("Face verification could not confirm that you are present. Please try again.")
        return
      }

      // ─── ENROLL MODE (Progressive Multi-Sample Registration) ───
      if (mode === "enroll") {
        if (detection.isProperlyPositioned && detection.isLive && detection.qualityScore >= 0.65) {
          const now = performance.now()
          if (now - lastSampleTimeRef.current >= MIN_SAMPLE_GAP_MS) {
            lastSampleTimeRef.current = now
            sampleBufferRef.current.push({
              descriptor: detection.descriptor,
              qualityScore: detection.qualityScore,
              landmarks: detection.landmarks,
              timestamp: now,
            })

            const currentCount = sampleBufferRef.current.length
            setSampleCount(currentCount)
            setScanStatus("capturing")
            setActiveGuidance(`Capturing sample ${currentCount} of ${REQUIRED_ENROLL_SAMPLES}… Hold still.`)
            NativeBridge.vibrate(ImpactStyle.Light)

            if (currentCount >= REQUIRED_ENROLL_SAMPLES) {
              verificationLockedRef.current = true
              setScanStatus("matched")
              setActiveGuidance("Biometric profile successfully registered.")

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
          }
          return
        }
        return
      }

      // ─── VERIFY MODE (Fast Self-Attendance Identity Verification) ───
      if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
        setScanStatus("no_enrolled")
        setActiveGuidance("No registered face found for this account. Please contact school administration.")
        return
      }

      setScanStatus("analyzing")
      const matchResult: FaceMatchResult = verifyFaceMatch(detection.descriptor, enrolledDescriptor)

      if (matchResult.isMatch && detection.isLive) {
        consecutiveMatchesRef.current++
        nonMatchFramesRef.current = 0

        // Require 2 consecutive matching frames (or single very clear match) for confirmed identity
        if (consecutiveMatchesRef.current >= 2 || matchResult.confidence >= 0.82) {
          verificationLockedRef.current = true
          setScanStatus("matched")
          setActiveGuidance("Identity verified successfully.")
          stopCameraStream()
          NativeBridge.vibrate(ImpactStyle.Light)
          onVerified?.({
            descriptor: detection.descriptor,
            confidence: matchResult.confidence,
          })
          return
        }
      } else {
        consecutiveMatchesRef.current = 0
        nonMatchFramesRef.current++

        // Failure Type 5: Face not matched to registered template
        setScanStatus("not_recognized")
        if (nonMatchFramesRef.current >= 3) {
          setActiveGuidance("Face not recognized. Please try again.")
        }
      }
    } catch {
      // Continue to next frame gracefully
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
  ])

  // Trigger analysis loop when camera and models are ready
  useEffect(() => {
    if (!isCameraReady || !isModelsLoaded || verificationLockedRef.current || scanStatus === "idle") return
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
    scanStatus === "not_recognized"

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-3 select-none">
      {/* ─── 0. CAMERA SELECTION CONTROLS (BEFORE SCANNING / IDLE) ─── */}
      {scanStatus === "idle" && (
        <div className="w-full flex items-center justify-between p-1.5 rounded-2xl bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setFacingMode("user")}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              isFrontCamera
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
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              !isFrontCamera
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Back Camera</span>
          </button>
        </div>
      )}

      {/* ─── 1. CAMERA VIEWPORT ─── */}
      <div
        ref={frameContainerRef}
        className="relative w-full aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-950 flex items-center justify-center"
        style={{
          boxShadow: cfg.frameShadow,
          border: `2px solid ${cfg.frameColor}`,
          transition: "border-color 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        {/* Live video feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 w-full h-full object-cover ${
            isFrontCamera ? "-scale-x-100" : "scale-x-100"
          }`}
        />

        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />

        {/* ── Corner bracket markers ── */}
        <div className="absolute top-5 left-5 pointer-events-none" style={{ width: 26, height: 26 }}>
          <div className="absolute top-0 left-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute top-0 left-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>
        <div className="absolute top-5 right-5 pointer-events-none" style={{ width: 26, height: 26 }}>
          <div className="absolute top-0 right-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute top-0 right-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>
        <div className="absolute bottom-16 left-5 pointer-events-none" style={{ width: 26, height: 26 }}>
          <div className="absolute bottom-0 left-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute bottom-0 left-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>
        <div className="absolute bottom-16 right-5 pointer-events-none" style={{ width: 26, height: 26 }}>
          <div className="absolute bottom-0 right-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute bottom-0 right-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>

        {/* ── PROMINENT START BUTTON & IDLE OVERLAY ── */}
        {scanStatus === "idle" && (
          <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shadow-lg text-primary">
              <Camera className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {mode === "enroll" ? "Biometric Registration" : "Self-Attendance Verification"}
              </h3>
              <p className="text-xs text-neutral-300 max-w-[220px]">
                {mode === "enroll"
                  ? "Position your face in the center of the camera"
                  : "Look directly at the camera to verify your identity"}
              </p>
            </div>

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
              border: `1px solid ${cfg.frameColor}`,
              color:
                scanStatus === "matched"
                  ? "#6ee7b7"
                  : isFailedState
                  ? "#fca5a5"
                  : "#e2e8f0",
            }}
          >
            {mode === "enroll"
              ? `Sample ${sampleCount}/${REQUIRED_ENROLL_SAMPLES}`
              : scanStatus === "matched"
              ? "Verified"
              : "Face Verification"}
          </Badge>
        </div>

        {/* ── Progressive Enrollment Sample Dots (Enroll Mode) ── */}
        {mode === "enroll" && isCameraReady && scanStatus !== "idle" && (
          <div className="absolute top-12 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none z-10">
            {Array.from({ length: REQUIRED_ENROLL_SAMPLES }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i < sampleCount
                    ? "bg-emerald-400 scale-125 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : i === sampleCount
                    ? "bg-primary/80 animate-pulse scale-110"
                    : "bg-white/30"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Bottom status pill inside viewport ── */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pointer-events-none z-10">
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-2 backdrop-blur-md"
            style={{
              background: "rgba(0,0,0,0.80)",
              border: `1px solid ${cfg.frameColor}`,
            }}
          >
            {cfg.showScanLine && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: cfg.scanLineColor,
                  boxShadow: `0 0 6px ${cfg.scanLineColor}`,
                  animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
            )}
            {scanStatus === "matched" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            {isFailedState && (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}

            <span
              className="text-xs font-semibold leading-tight flex-1"
              style={{
                color:
                  scanStatus === "matched"
                    ? "#6ee7b7"
                    : scanStatus === "not_recognized"
                    ? "#fde68a"
                    : isFailedState
                    ? "#fca5a5"
                    : "#f1f5f9",
              }}
            >
              {activeGuidance || cfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. BELOW-FRAME STATUS STRIP ─── */}
      <div
        className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition-all duration-200"
        style={{
          background:
            scanStatus === "matched"
              ? "rgba(16,185,129,0.12)"
              : isFailedState
              ? "rgba(244,63,94,0.08)"
              : "rgba(147,51,234,0.08)",
          border: `1px solid ${cfg.frameColor.replace(/[\d.]+\)$/, "0.3)")}`,
        }}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-xs font-bold text-foreground leading-snug truncate">
            {scanStatus === "idle"
              ? "Camera Ready"
              : scanStatus === "matched"
              ? "✓ Verification Successful"
              : scanStatus === "initializing"
              ? "Starting camera…"
              : scanStatus === "capturing"
              ? `Capturing Sample ${sampleCount} of ${REQUIRED_ENROLL_SAMPLES}…`
              : scanStatus === "timeout" || scanStatus === "not_recognized"
              ? "Verification Needed"
              : "Scanning Face"}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium truncate">
            {activeGuidance ||
              (scanStatus === "idle"
                ? "Press Start Camera to verify"
                : scanStatus === "matched"
                ? "Identity confirmed"
                : "Keep your face inside the frame")}
          </span>
        </div>

        {/* Live scanning pulse or checkmark */}
        {cfg.showScanLine && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Live</span>
          </div>
        )}
        {scanStatus === "matched" && (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        )}
      </div>

      {/* ─── 3. ACTION CONTROLS & CAMERA SWITCHING ─── */}
      <div className="w-full flex items-center justify-between gap-2 pt-0.5">
        {/* Switch camera / stop button when scanning */}
        {scanStatus !== "idle" && scanStatus !== "matched" && (
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

        {/* Immediate retry button on timeout, not recognized, or error */}
        {(scanStatus === "error" || scanStatus === "timeout" || scanStatus === "not_recognized") && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => startCamera(facingMode)}
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
    </div>
  )
}
