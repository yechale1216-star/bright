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
  Sparkles,
  ShieldCheck,
  User,
} from "lucide-react"
import { useFaceRecognition, FaceDetectionResult, FaceMatchResult } from "@/lib/hooks/use-face-recognition"
import { NativeBridge } from "@/lib/utils/native-bridge"
import { ImpactStyle } from "@capacitor/haptics"

export interface FaceVerificationCameraProps {
  mode: "enroll" | "verify"
  enrolledDescriptor?: number[] | null
  onVerified?: (result: { descriptor: number[]; confidence?: number }) => void
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

// Visual configuration per state
const STATE_CONFIG: Record<
  ScanStatus,
  { label: string; scanLineColor: string; frameColor: string; frameShadow: string; showScanLine: boolean }
> = {
  idle: {
    label: "Ready to scan — press Start",
    scanLineColor: "rgba(147,51,234,0.4)",
    frameColor: "rgba(147,51,234,0.25)",
    frameShadow: "0 0 16px rgba(147,51,234,0.15)",
    showScanLine: false,
  },
  initializing: {
    label: "Starting camera & biometric engine…",
    scanLineColor: "rgba(147,51,234,0.6)",
    frameColor: "rgba(147,51,234,0.35)",
    frameShadow: "0 0 18px rgba(147,51,234,0.2)",
    showScanLine: false,
  },
  detecting: {
    label: "Scanning for face…",
    scanLineColor: "rgba(147,51,234,0.85)",
    frameColor: "rgba(147,51,234,0.5)",
    frameShadow: "0 0 22px rgba(147,51,234,0.3)",
    showScanLine: true,
  },
  analyzing: {
    label: "Face detected — analyzing…",
    scanLineColor: "rgba(99,102,241,1)",
    frameColor: "rgba(99,102,241,0.75)",
    frameShadow: "0 0 28px rgba(99,102,241,0.45)",
    showScanLine: true,
  },
  capturing: {
    label: "Ready — capturing automatically…",
    scanLineColor: "rgba(16,185,129,1)",
    frameColor: "rgba(16,185,129,0.8)",
    frameShadow: "0 0 32px rgba(16,185,129,0.5)",
    showScanLine: true,
  },
  matched: {
    label: "✓ Face Processed Successfully",
    scanLineColor: "rgba(16,185,129,0.9)",
    frameColor: "rgba(16,185,129,0.7)",
    frameShadow: "0 0 40px rgba(16,185,129,0.55)",
    showScanLine: false,
  },
  not_recognized: {
    label: "Align face inside frame…",
    scanLineColor: "rgba(251,191,36,0.8)",
    frameColor: "rgba(251,191,36,0.5)",
    frameShadow: "0 0 22px rgba(251,191,36,0.3)",
    showScanLine: true,
  },
  multiple_faces: {
    label: "Only one face should be visible",
    scanLineColor: "rgba(244,63,94,0.8)",
    frameColor: "rgba(244,63,94,0.5)",
    frameShadow: "0 0 22px rgba(244,63,94,0.3)",
    showScanLine: false,
  },
  no_enrolled: {
    label: "No biometric record found",
    scanLineColor: "rgba(244,63,94,0.8)",
    frameColor: "rgba(244,63,94,0.5)",
    frameShadow: "0 0 22px rgba(244,63,94,0.3)",
    showScanLine: false,
  },
  timeout: {
    label: "Scanning timed out — tap retry",
    scanLineColor: "rgba(244,63,94,0.8)",
    frameColor: "rgba(244,63,94,0.5)",
    frameShadow: "0 0 22px rgba(244,63,94,0.3)",
    showScanLine: false,
  },
  error: {
    label: "Camera unavailable",
    scanLineColor: "rgba(244,63,94,0.6)",
    frameColor: "rgba(244,63,94,0.4)",
    frameShadow: "0 0 18px rgba(244,63,94,0.2)",
    showScanLine: false,
  },
}

const CAMERA_INIT_TIMEOUT_MS = 8000
const SCAN_TIMEOUT_MS = 30000
const LOOP_INTERVAL_MS = 80 // fast 80ms sequential gap for smooth & responsive real-time inference

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
  const [matchScore, setMatchScore] = useState<number | null>(null)

  // Lifecycle guards & timers
  const mountedRef = useRef(true)
  const isAnalyzingRef = useRef(false)
  const verificationLockedRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { isModelsLoaded, loadModels, detectFaceFromVideo, verifyFaceMatch } = useFaceRecognition()

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
  }, [])

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
      setMatchScore(null)
      verificationLockedRef.current = false
      isAnalyzingRef.current = false

      stopCameraStream()

      let initTimedOut = false
      const initTimer = setTimeout(() => {
        initTimedOut = true
        if (mountedRef.current && !verificationLockedRef.current) {
          setScanStatus("error")
          onFailed?.("Camera initialization timed out. Please check camera permissions.")
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

        // Start overall scanning timeout (30s)
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !verificationLockedRef.current) {
            setScanStatus("timeout")
          }
        }, SCAN_TIMEOUT_MS)
      } catch (err: any) {
        clearTimeout(initTimer)
        if (!mountedRef.current) return
        const msg =
          err.name === "NotAllowedError"
            ? "Camera permission denied. Please grant camera access in your device settings."
            : "Camera not accessible or currently in use by another app."
        setScanStatus("error")
        onFailed?.(msg)
      }
    },
    [facingMode, onFailed, stopCameraStream]
  )

  const handleStopAndReset = () => {
    stopCameraStream()
    setScanStatus("idle")
    verificationLockedRef.current = false
    setMatchScore(null)
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
        loopTimeoutRef.current = setTimeout(analyzeFrame, 80)
      }
      return
    }

    isAnalyzingRef.current = true

    try {
      const detection: FaceDetectionResult = await detectFaceFromVideo(vid)

      if (!mountedRef.current || verificationLockedRef.current) return

      // Case 1: Multiple faces detected
      if (detection.multipleFaces) {
        setScanStatus("multiple_faces")
        return
      }

      // Case 2: No face detected
      if (!detection.detected || !detection.descriptor) {
        setScanStatus("detecting")
        setMatchScore(null)
        return
      }

      // Case 3: Face found — analyze positioning and landmarks
      setScanStatus("analyzing")

      // ─── ENROLL MODE (100% Automatic Fast Capture) ───
      if (mode === "enroll") {
        if (detection.isProperlyPositioned && detection.isLive) {
          // Immediately enter capturing state
          setScanStatus("capturing")
          verificationLockedRef.current = true

          // Immediate lock, stop stream & complete registration without delay
          stopCameraStream()
          setScanStatus("matched")
          NativeBridge.vibrate(ImpactStyle.Medium)
          onVerified?.({ descriptor: detection.descriptor, confidence: 1.0 })
          return
        }
        return
      }

      // ─── VERIFY MODE (Fast Live Biometric Matching) ───
      if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
        setScanStatus("no_enrolled")
        return
      }

      const matchResult: FaceMatchResult = verifyFaceMatch(detection.descriptor, enrolledDescriptor)
      setMatchScore(matchResult.confidence)

      if (matchResult.isMatch && detection.isLive) {
        // MATCH CONFIRMED -> Immediately lock, stop stream, vibrate, and notify
        verificationLockedRef.current = true
        setScanStatus("matched")
        stopCameraStream()
        NativeBridge.vibrate(ImpactStyle.Light)
        onVerified?.({ descriptor: detection.descriptor, confidence: matchResult.confidence })
        return
      } else {
        setScanStatus("not_recognized")
      }
    } catch {
      // Continue to next frame
    } finally {
      isAnalyzingRef.current = false
      // Schedule next frame sequentially
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
        {/* Live video feed (mirror front camera, unmirror back camera) */}
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
                {mode === "enroll" ? "Ready to Register Face" : "Ready for Verification"}
              </h3>
              <p className="text-xs text-neutral-300 max-w-[220px]">
                {isFrontCamera ? "Using Front Camera" : "Using Back Camera"}
              </p>
            </div>

            <Button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="h-12 px-6 rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-2 active:scale-95 transition-transform"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Camera & Scan</span>
            </Button>
          </div>
        )}

        {/* ── Initializing Loading Spinner ── */}
        {scanStatus === "initializing" && (
          <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center gap-3">
            <RefreshCw className="w-10 h-10 animate-spin text-primary" />
            <p className="text-xs font-semibold text-white">Starting camera...</p>
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
              color: scanStatus === "matched" ? "#6ee7b7" : scanStatus === "multiple_faces" || scanStatus === "no_enrolled" || scanStatus === "error" || scanStatus === "timeout" ? "#fca5a5" : "#e2e8f0",
            }}
          >
            {mode === "enroll" ? "Automatic Enrollment" : "Biometric Match"}
          </Badge>

          {matchScore !== null && matchScore > 0 && (
            <Badge
              className="text-[11px] font-mono font-bold px-2 py-0.5"
              style={{
                background: matchScore >= 0.5 ? "rgba(16,185,129,0.85)" : "rgba(251,191,36,0.85)",
                color: "#fff",
              }}
            >
              {(matchScore * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        {/* ── Bottom status pill inside viewport ── */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pointer-events-none z-10">
          <div
            className="rounded-xl px-3 py-2 flex items-center gap-2 backdrop-blur-md"
            style={{
              background: "rgba(0,0,0,0.75)",
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
            {(scanStatus === "multiple_faces" || scanStatus === "no_enrolled" || scanStatus === "error" || scanStatus === "timeout") && (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            {scanStatus === "not_recognized" && (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}

            <span
              className="text-xs font-semibold leading-tight flex-1"
              style={{
                color: scanStatus === "matched"
                  ? "#6ee7b7"
                  : scanStatus === "not_recognized"
                  ? "#fde68a"
                  : scanStatus === "multiple_faces" || scanStatus === "error" || scanStatus === "no_enrolled" || scanStatus === "timeout"
                  ? "#fca5a5"
                  : "#f1f5f9",
              }}
            >
              {scanStatus === "matched" && mode === "enroll"
                ? "✓ Face Enrolled Successfully"
                : cfg.label}
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
              : scanStatus === "multiple_faces" || scanStatus === "error" || scanStatus === "no_enrolled" || scanStatus === "timeout"
              ? "rgba(244,63,94,0.08)"
              : scanStatus === "not_recognized"
              ? "rgba(251,191,36,0.08)"
              : "rgba(147,51,234,0.08)",
          border: `1px solid ${cfg.frameColor.replace(/[\d.]+\)$/, "0.3)")}`,
        }}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-xs font-bold text-foreground leading-snug truncate">
            {scanStatus === "idle"
              ? "Camera Ready"
              : scanStatus === "matched"
              ? mode === "enroll"
                ? "✓ Face biometric registered"
                : "✓ Biometric identity verified"
              : scanStatus === "initializing"
              ? "Starting camera stream…"
              : scanStatus === "capturing"
              ? "Auto-capture in progress…"
              : scanStatus === "timeout"
              ? "Scan session timed out"
              : mode === "enroll"
              ? "Automatic enrollment active"
              : "Continuous auto-scan active"}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium truncate">
            {scanStatus === "idle"
              ? "Choose camera and press Start"
              : scanStatus === "matched"
              ? "Biometric signature saved"
              : scanStatus === "detecting"
              ? "Center your face in the oval frame"
              : scanStatus === "analyzing"
              ? "Face detected — analyzing quality…"
              : scanStatus === "capturing"
              ? "Capturing biometric representation…"
              : scanStatus === "not_recognized"
              ? "Align face in good lighting"
              : scanStatus === "timeout"
              ? "Tap Retry to begin again"
              : ""}
          </span>
        </div>

        {/* Live scanning pulse */}
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

        {/* Retry button on error or timeout */}
        {(scanStatus === "error" || scanStatus === "timeout") && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => startCamera(facingMode)}
            className="flex-1 gap-1.5 rounded-xl font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Scanner
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
