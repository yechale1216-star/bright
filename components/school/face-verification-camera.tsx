"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
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
  | "initializing"
  | "detecting"
  | "scanning"
  | "matching"
  | "matched"
  | "not_recognized"
  | "multiple_faces"
  | "no_enrolled"
  | "error"

// Labels and colors per state
const STATE_CONFIG: Record<
  ScanStatus,
  { label: string; scanLineColor: string; frameColor: string; frameShadow: string; showScanLine: boolean }
> = {
  initializing: {
    label: "Initializing scanner…",
    scanLineColor: "rgba(147,51,234,0.6)",
    frameColor: "rgba(147,51,234,0.35)",
    frameShadow: "0 0 18px rgba(147,51,234,0.2)",
    showScanLine: false,
  },
  detecting: {
    label: "Looking for face…",
    scanLineColor: "rgba(147,51,234,0.8)",
    frameColor: "rgba(147,51,234,0.5)",
    frameShadow: "0 0 22px rgba(147,51,234,0.3)",
    showScanLine: true,
  },
  scanning: {
    label: "Scanning face…",
    scanLineColor: "rgba(99,102,241,1)",
    frameColor: "rgba(99,102,241,0.7)",
    frameShadow: "0 0 28px rgba(99,102,241,0.45)",
    showScanLine: true,
  },
  matching: {
    label: "Verifying identity…",
    scanLineColor: "rgba(168,85,247,1)",
    frameColor: "rgba(168,85,247,0.8)",
    frameShadow: "0 0 32px rgba(168,85,247,0.5)",
    showScanLine: true,
  },
  matched: {
    label: "✓ Face Verified",
    scanLineColor: "rgba(16,185,129,0.9)",
    frameColor: "rgba(16,185,129,0.7)",
    frameShadow: "0 0 40px rgba(16,185,129,0.55)",
    showScanLine: false,
  },
  not_recognized: {
    label: "Face not recognized — try again",
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
  error: {
    label: "Camera unavailable",
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
  const scanDirRef = useRef(1) // 1 = down, -1 = up
  const scanPosRef = useRef(0) // 0..100 percent

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus>("initializing")
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [matchScore, setMatchScore] = useState<number | null>(null)

  // Guards
  const isAnalyzingRef = useRef(false)
  const verificationLockedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const { isModelsLoaded, loadModels, detectFaceFromVideo, verifyFaceMatch } = useFaceRecognition()

  // ─── Scanning line animation via rAF (CSS-independent, smooth) ───
  const runScanAnimation = useCallback(() => {
    const el = scanLineRef.current
    if (!el) return

    const SPEED = 0.45 // percent per frame @60fps ≈ 27%/s → ~3.7s full cycle
    scanPosRef.current += SPEED * scanDirRef.current
    if (scanPosRef.current >= 96) { scanPosRef.current = 96; scanDirRef.current = -1 }
    if (scanPosRef.current <= 4)  { scanPosRef.current = 4;  scanDirRef.current = 1 }

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

  // Load models on mount
  useEffect(() => { loadModels() }, [loadModels])

  // Start/stop scan-line animation based on scan status
  useEffect(() => {
    const cfg = STATE_CONFIG[scanStatus]
    if (cfg.showScanLine) {
      startScanAnimation()
    } else {
      stopScanAnimation()
    }
    return stopScanAnimation
  }, [scanStatus, startScanAnimation, stopScanAnimation])

  // ─── Camera startup ───
  const startCamera = useCallback(async () => {
    setScanStatus("initializing")
    setIsCameraReady(false)
    setMatchScore(null)
    verificationLockedRef.current = false

    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()) }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = mediaStream
      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      setIsCameraReady(true)
      setScanStatus("detecting")
    } catch (err: any) {
      const msg =
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please grant camera access."
          : "Camera not accessible or already in use."
      setScanStatus("error")
      if (onFailed) onFailed(msg)
    }
  }, [onFailed])

  useEffect(() => {
    startCamera()
    return () => {
      stopScanAnimation()
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Frame analysis (polling every 200ms for near-instant response) ───
  const analyzeFrame = useCallback(async () => {
    if (
      verificationLockedRef.current ||
      isAnalyzingRef.current ||
      !videoRef.current ||
      !isModelsLoaded ||
      !isCameraReady
    ) return

    const vid = videoRef.current
    if (vid.videoWidth === 0 || vid.videoHeight === 0 || vid.readyState < 2) return

    isAnalyzingRef.current = true

    try {
      const detection: FaceDetectionResult = await detectFaceFromVideo(vid)

      if (verificationLockedRef.current) return

      // Multiple faces
      if (detection.multipleFaces) {
        setScanStatus("multiple_faces")
        isAnalyzingRef.current = false
        return
      }

      // No face
      if (!detection.detected || !detection.descriptor) {
        setScanStatus("detecting")
        setMatchScore(null)
        isAnalyzingRef.current = false
        return
      }

      // Face found → scanning
      setScanStatus("scanning")

      // Enroll mode
      if (mode === "enroll") {
        if (detection.isProperlyPositioned && detection.isLive) {
          verificationLockedRef.current = true
          setScanStatus("matched")
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
          NativeBridge.vibrate(ImpactStyle.Medium)
          onVerified?.({ descriptor: detection.descriptor, confidence: 1.0 })
        }
        isAnalyzingRef.current = false
        return
      }

      // Verify mode
      if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
        setScanStatus("no_enrolled")
        isAnalyzingRef.current = false
        return
      }

      // Start matching phase
      setScanStatus("matching")
      const matchResult: FaceMatchResult = verifyFaceMatch(detection.descriptor, enrolledDescriptor)
      setMatchScore(matchResult.confidence)

      if (matchResult.isMatch && detection.isLive) {
        verificationLockedRef.current = true
        setScanStatus("matched")
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        NativeBridge.vibrate(ImpactStyle.Light)
        onVerified?.({ descriptor: detection.descriptor, confidence: matchResult.confidence })
      } else {
        setScanStatus("not_recognized")
        // Reset to detecting after brief pause so scanning resumes naturally
        setTimeout(() => {
          if (!verificationLockedRef.current) setScanStatus("detecting")
        }, 1200)
      }
    } catch {
      // Silently continue — don't surface internal detection errors
    } finally {
      isAnalyzingRef.current = false
    }
  }, [isModelsLoaded, isCameraReady, detectFaceFromVideo, mode, enrolledDescriptor, verifyFaceMatch, onVerified])

  // Set up 200ms poll
  useEffect(() => {
    if (!isCameraReady || !isModelsLoaded || verificationLockedRef.current) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(analyzeFrame, 200)
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [isCameraReady, isModelsLoaded, analyzeFrame])

  // Manual capture for enroll mode
  const handleManualCaptureEnroll = useCallback(async () => {
    if (!videoRef.current || !isModelsLoaded || isAnalyzingRef.current) return
    isAnalyzingRef.current = true
    try {
      const detection = await detectFaceFromVideo(videoRef.current)
      if (detection.detected && detection.descriptor) {
        verificationLockedRef.current = true
        setScanStatus("matched")
        NativeBridge.vibrate(ImpactStyle.Medium)
        onVerified?.({ descriptor: detection.descriptor, confidence: 1.0 })
      }
    } finally {
      isAnalyzingRef.current = false
    }
  }, [isModelsLoaded, detectFaceFromVideo, onVerified])

  const cfg = STATE_CONFIG[scanStatus]

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-3 select-none">

      {/* ─── CAMERA VIEWPORT ─── */}
      <div
        ref={frameContainerRef}
        className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-950"
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
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        />

        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />

        {/* ── Corner bracket markers (Google Pixel-style) ── */}
        {/* Top-left */}
        <div className="absolute top-6 left-6 pointer-events-none" style={{ width: 28, height: 28 }}>
          <div className="absolute top-0 left-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute top-0 left-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>
        {/* Top-right */}
        <div className="absolute top-6 right-6 pointer-events-none" style={{ width: 28, height: 28 }}>
          <div className="absolute top-0 right-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute top-0 right-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>
        {/* Bottom-left */}
        <div className="absolute bottom-16 left-6 pointer-events-none" style={{ width: 28, height: 28 }}>
          <div className="absolute bottom-0 left-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute bottom-0 left-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>
        {/* Bottom-right */}
        <div className="absolute bottom-16 right-6 pointer-events-none" style={{ width: 28, height: 28 }}>
          <div className="absolute bottom-0 right-0 w-full h-[3px] rounded-full" style={{ background: cfg.frameColor }} />
          <div className="absolute bottom-0 right-0 w-[3px] h-full rounded-full" style={{ background: cfg.frameColor }} />
        </div>

        {/* ── Animated scan line (rAF-driven, top↔bottom) ── */}
        {cfg.showScanLine && (
          <div
            ref={scanLineRef}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: "50%",
              height: 3,
              marginLeft: 24,
              marginRight: 24,
              background: `linear-gradient(90deg, transparent 0%, ${cfg.scanLineColor} 20%, #fff 50%, ${cfg.scanLineColor} 80%, transparent 100%)`,
              borderRadius: 4,
              filter: "blur(0.5px)",
              boxShadow: `0 0 10px 4px ${cfg.scanLineColor.replace(")", ", 0.4)").replace("rgba", "rgba")}, 0 0 2px 1px #fff`,
              willChange: "top",
            }}
          />
        )}

        {/* ── Success ripple overlay ── */}
        {scanStatus === "matched" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 rounded-full border-4 border-emerald-400/80 animate-ping" style={{ animationDuration: "0.8s" }} />
            <div className="absolute w-16 h-16 rounded-full bg-emerald-500/25 animate-ping" style={{ animationDuration: "0.6s" }} />
            <CheckCircle2 className="absolute w-10 h-10 text-emerald-400 drop-shadow-lg" style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.9))" }} />
          </div>
        )}

        {/* ── Top mode badge ── */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <Badge
            variant="outline"
            className="backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase"
            style={{
              background: "rgba(0,0,0,0.72)",
              border: `1px solid ${cfg.frameColor}`,
              color: scanStatus === "matched" ? "#6ee7b7" : scanStatus === "multiple_faces" || scanStatus === "no_enrolled" || scanStatus === "error" ? "#fca5a5" : "#e2e8f0",
            }}
          >
            {mode === "enroll" ? "Enrollment" : "Live Biometric"}
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
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pointer-events-none">
          <div
            className="rounded-xl px-3 py-2 flex items-center gap-2 backdrop-blur-md"
            style={{
              background: "rgba(0,0,0,0.70)",
              border: `1px solid ${cfg.frameColor}`,
            }}
          >
            {/* Pulsing dot indicator */}
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
            {(scanStatus === "multiple_faces" || scanStatus === "no_enrolled" || scanStatus === "error") && (
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
                  : scanStatus === "multiple_faces" || scanStatus === "error" || scanStatus === "no_enrolled"
                  ? "#fca5a5"
                  : "#f1f5f9",
              }}
            >
              {cfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* ─── BELOW-FRAME STATUS STRIP ─── */}
      <div
        className="w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all duration-200"
        style={{
          background:
            scanStatus === "matched"
              ? "rgba(16,185,129,0.12)"
              : scanStatus === "multiple_faces" || scanStatus === "error" || scanStatus === "no_enrolled"
              ? "rgba(244,63,94,0.08)"
              : scanStatus === "not_recognized"
              ? "rgba(251,191,36,0.08)"
              : "rgba(147,51,234,0.08)",
          border: `1px solid ${cfg.frameColor.replace(/[\d.]+\)$/, "0.3)")}`,
        }}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-xs font-bold text-foreground leading-snug truncate">
            {scanStatus === "matched"
              ? "Attendance recorded automatically"
              : scanStatus === "initializing"
              ? "Preparing biometric scanner…"
              : "Continuous auto-scan active — no buttons needed"}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">
            {scanStatus === "matched"
              ? "You may close this window"
              : scanStatus === "detecting"
              ? "Position your face in the frame"
              : scanStatus === "scanning"
              ? "Hold still…"
              : scanStatus === "matching"
              ? "Comparing biometric signature…"
              : scanStatus === "not_recognized"
              ? "Align face fully inside the frame"
              : ""}
          </span>
        </div>

        {/* Live pulse when scanning */}
        {cfg.showScanLine && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Live</span>
          </div>
        )}
        {scanStatus === "matched" && (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        )}
      </div>

      {/* ─── ACTION BUTTONS ─── */}
      <div className="w-full flex items-center gap-2">
        {mode === "enroll" && scanStatus !== "matched" && (
          <Button
            type="button"
            onClick={handleManualCaptureEnroll}
            disabled={!isCameraReady || !isModelsLoaded}
            className="flex-1 font-semibold gap-2 bg-primary hover:bg-primary/90 shadow-md"
          >
            <Camera className="w-4 h-4" />
            Capture Face
          </Button>
        )}

        {scanStatus === "error" && (
          <Button
            type="button"
            variant="outline"
            onClick={startCamera}
            className="flex-1 gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Camera
          </Button>
        )}

        {onCancel && scanStatus !== "matched" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-muted-foreground text-xs ml-auto"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
