"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Scan,
  UserCheck,
  Eye,
  Activity,
  ShieldCheck,
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
  | "detecting_face"
  | "face_detected"
  | "verifying"
  | "matched"
  | "not_recognized"
  | "multiple_faces"
  | "no_enrolled"
  | "error"

export function FaceVerificationCamera({
  mode,
  enrolledDescriptor,
  onVerified,
  onFailed,
  onCancel,
}: FaceVerificationCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus>("initializing")
  const [statusMessage, setStatusMessage] = useState("Initializing camera & face recognition...")
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)

  // Double-submission lock and frame analysis guards
  const isAnalyzingRef = useRef(false)
  const verificationLockedRef = useRef(false)
  const consecutiveMatchesRef = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const { isModelsLoaded, loadModels, detectFaceFromVideo, verifyFaceMatch } = useFaceRecognition()

  // 1. Initialize face recognition models
  useEffect(() => {
    loadModels()
  }, [loadModels])

  // 2. Start webcam stream
  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScanStatus("initializing")
    setStatusMessage("Opening camera...")
    setIsCameraReady(false)
    verificationLockedRef.current = false
    consecutiveMatchesRef.current = 0

    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      setIsCameraReady(true)
      setScanStatus("detecting_face")
      setStatusMessage(mode === "enroll" ? "Detecting face…" : "Detecting face…")
    } catch (err: any) {
      console.error("[FaceCamera] Camera error:", err)
      const errorMsg =
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please grant camera access to continue."
          : "Camera not accessible or already in use."
      setCameraError(errorMsg)
      setScanStatus("error")
      setStatusMessage(errorMsg)
      if (onFailed) onFailed(errorMsg)
    }
  }, [stream, mode, onFailed])

  useEffect(() => {
    startCamera()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // 3. Continuous frame analyzer loop for auto-detection and verification
  const analyzeFrame = useCallback(async () => {
    // Guards: don't analyze if locked, already analyzing, models not loaded, or camera not ready
    if (
      verificationLockedRef.current ||
      isAnalyzingRef.current ||
      !videoRef.current ||
      !isModelsLoaded ||
      !isCameraReady
    ) {
      return
    }

    // Video must have valid dimensions
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      return
    }

    isAnalyzingRef.current = true

    try {
      const detection: FaceDetectionResult = await detectFaceFromVideo(videoRef.current)

      // Check verification lock again in case state changed asynchronously
      if (verificationLockedRef.current) {
        isAnalyzingRef.current = false
        return
      }

      // 1. Handle multiple faces
      if (detection.multipleFaces) {
        consecutiveMatchesRef.current = 0
        setScanStatus("multiple_faces")
        setStatusMessage("Only one face should be visible.")
        isAnalyzingRef.current = false
        return
      }

      // 2. Handle no face detected
      if (!detection.detected || !detection.descriptor) {
        consecutiveMatchesRef.current = 0
        setScanStatus("detecting_face")
        setStatusMessage("Detecting face…")
        setMatchScore(null)
        isAnalyzingRef.current = false
        return
      }

      // 3. Face detected!
      setScanStatus("face_detected")

      // 4. In ENROLL mode:
      if (mode === "enroll") {
        if (detection.isProperlyPositioned && detection.isLive) {
          setScanStatus("matched")
          setStatusMessage("Face successfully captured!")
          verificationLockedRef.current = true
          NativeBridge.vibrate(ImpactStyle.Medium)
          if (onVerified) {
            onVerified({ descriptor: detection.descriptor, confidence: 1.0 })
          }
        } else {
          setStatusMessage("Face detected — hold still inside the frame...")
        }
        isAnalyzingRef.current = false
        return
      }

      // 5. In VERIFY mode:
      if (mode === "verify") {
        if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
          setScanStatus("no_enrolled")
          setStatusMessage("No enrolled face record found for this staff member.")
          isAnalyzingRef.current = false
          return
        }

        setScanStatus("verifying")
        setStatusMessage("Verifying identity…")

        const matchResult: FaceMatchResult = verifyFaceMatch(detection.descriptor, enrolledDescriptor)
        setMatchScore(matchResult.confidence)

        if (matchResult.isMatch && detection.isLive) {
          consecutiveMatchesRef.current += 1

          // Immediately lock and complete auto-verification
          verificationLockedRef.current = true
          setScanStatus("matched")
          setStatusMessage("Ready ✓")
          NativeBridge.vibrate(ImpactStyle.Light)

          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }

          if (onVerified) {
            onVerified({
              descriptor: detection.descriptor,
              confidence: matchResult.confidence,
            })
          }
        } else {
          consecutiveMatchesRef.current = 0
          setScanStatus("not_recognized")
          setStatusMessage("Face not recognized — please position your face inside the frame.")
        }
      }
    } catch (err: any) {
      console.warn("[FaceCamera] Continuous scan cycle error:", err)
    } finally {
      isAnalyzingRef.current = false
    }
  }, [
    isModelsLoaded,
    isCameraReady,
    detectFaceFromVideo,
    mode,
    enrolledDescriptor,
    verifyFaceMatch,
    onVerified,
  ])

  // Set up continuous scan interval (~280ms interval)
  useEffect(() => {
    if (isCameraReady && isModelsLoaded && !verificationLockedRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        analyzeFrame()
      }, 280)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isCameraReady, isModelsLoaded, analyzeFrame])

  // Manual fallback capture for enrollment mode only
  const handleManualCaptureEnroll = async () => {
    if (!videoRef.current || !isModelsLoaded || isAnalyzingRef.current) return
    isAnalyzingRef.current = true
    try {
      const detection = await detectFaceFromVideo(videoRef.current)
      if (detection.detected && detection.descriptor) {
        verificationLockedRef.current = true
        setScanStatus("matched")
        setStatusMessage("Face successfully captured!")
        NativeBridge.vibrate(ImpactStyle.Medium)
        if (onVerified) {
          onVerified({ descriptor: detection.descriptor, confidence: 1.0 })
        }
      } else {
        setStatusMessage("No clear face detected. Please face camera directly.")
      }
    } finally {
      isAnalyzingRef.current = false
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto border-border/60 shadow-2xl overflow-hidden backdrop-blur-md bg-card/95">
      <CardContent className="p-4 sm:p-5 flex flex-col items-center gap-4">
        {/* Camera Viewport with Biometric Scanning HUD */}
        <div className="relative w-full aspect-[4/3] bg-neutral-950 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-inner flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Oval HUD with state-aware animations */}
          <div
            className={`absolute inset-5 sm:inset-6 border-2 border-dashed rounded-[46%] pointer-events-none transition-all duration-300 ${
              scanStatus === "matched"
                ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_35px_rgba(16,185,129,0.4)] ring-4 ring-emerald-500/30"
                : scanStatus === "multiple_faces" || scanStatus === "no_enrolled" || scanStatus === "error"
                ? "border-rose-500 bg-rose-500/15 shadow-[0_0_30px_rgba(244,63,94,0.35)]"
                : scanStatus === "not_recognized"
                ? "border-amber-400/90 bg-amber-400/10 shadow-[0_0_25px_rgba(251,191,36,0.3)]"
                : scanStatus === "verifying" || scanStatus === "face_detected"
                ? "border-primary bg-primary/10 animate-pulse shadow-[0_0_30px_rgba(147,51,234,0.3)]"
                : "border-primary/50 shadow-[0_0_20px_rgba(147,51,234,0.15)]"
            }`}
          >
            {/* Top / Bottom scan guide markers */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary/60 rounded-full" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary/60 rounded-full" />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary/60 rounded-full" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary/60 rounded-full" />
          </div>

          {/* Top Info Bar inside Viewport */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <Badge
              variant="outline"
              className={`backdrop-blur-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase border ${
                scanStatus === "matched"
                  ? "bg-emerald-950/85 text-emerald-300 border-emerald-500 shadow-md"
                  : scanStatus === "multiple_faces" || scanStatus === "no_enrolled"
                  ? "bg-rose-950/85 text-rose-300 border-rose-500"
                  : scanStatus === "verifying"
                  ? "bg-purple-950/85 text-purple-300 border-purple-500"
                  : "bg-black/75 text-neutral-200 border-neutral-700"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {scanStatus === "matched" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : scanStatus === "verifying" ? (
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                ) : (
                  <Scan className="w-3.5 h-3.5 text-primary" />
                )}
                <span>{mode === "enroll" ? "Enrollment Scan" : "Live Auto-Scan"}</span>
              </div>
            </Badge>

            {matchScore !== null && matchScore > 0 && (
              <Badge
                className={`text-xs font-mono font-bold px-2 py-0.5 shadow-md ${
                  matchScore >= 0.5
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-600/90 text-white"
                }`}
              >
                {(matchScore * 100).toFixed(0)}% Confidence
              </Badge>
            )}
          </div>

          {/* Center Scan Wave Animation when actively detecting */}
          {scanStatus !== "matched" && scanStatus !== "error" && (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse opacity-70 pointer-events-none" />
          )}
        </div>

        {/* ─── LIVE BIOMETRIC STATUS INDICATOR (REPLACES MANUAL VERIFY BUTTON) ─── */}
        <div
          className={`w-full p-3.5 rounded-xl border transition-all duration-300 flex flex-col gap-2 ${
            scanStatus === "matched"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 shadow-sm"
              : scanStatus === "multiple_faces" || scanStatus === "no_enrolled" || scanStatus === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
              : scanStatus === "not_recognized"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
              : scanStatus === "verifying"
              ? "bg-primary/15 border-primary/40 text-primary-foreground shadow-sm"
              : "bg-muted/60 border-border/50 text-foreground"
          }`}
        >
          {/* Main Status Label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              {scanStatus === "matched" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 animate-in zoom-in-75" />
              )}
              {(scanStatus === "multiple_faces" || scanStatus === "no_enrolled") && (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              )}
              {scanStatus === "not_recognized" && (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              {scanStatus === "verifying" && (
                <Sparkles className="w-5 h-5 text-primary animate-spin shrink-0" />
              )}
              {scanStatus === "face_detected" && (
                <Eye className="w-5 h-5 text-primary shrink-0 animate-pulse" />
              )}
              {scanStatus === "detecting_face" && (
                <Scan className="w-5 h-5 text-muted-foreground shrink-0 animate-pulse" />
              )}
              {scanStatus === "error" && (
                <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              )}
              <span className="leading-snug">{statusMessage}</span>
            </div>

            {/* Live Progress / Activity Indicator */}
            {scanStatus !== "matched" && scanStatus !== "error" && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                  Auto
                </span>
              </div>
            )}
          </div>

          {/* Subtext description & Live Scanning Wave */}
          {scanStatus !== "matched" && scanStatus !== "error" && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
                Continuous biometric verification active
              </span>
              <span className="text-[11px] font-medium text-foreground/80">
                No buttons required
              </span>
            </div>
          )}

          {scanStatus === "matched" && (
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between pt-1 border-t border-emerald-500/20">
              <span>Attendance recorded automatically</span>
              <span className="font-bold">✓ Verified</span>
            </div>
          )}
        </div>

        {/* Action Controls & Error Recovery */}
        <div className="w-full flex items-center justify-between gap-2">
          {/* In ENROLL mode only: optional capture button */}
          {mode === "enroll" && scanStatus !== "matched" && (
            <Button
              type="button"
              onClick={handleManualCaptureEnroll}
              disabled={!isCameraReady || isAnalyzingRef.current}
              className="flex-1 font-semibold gap-2 shadow-md bg-primary hover:bg-primary/90"
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
              className="flex-1 gap-1.5 border-primary/40 hover:bg-primary/10"
            >
              <RefreshCw className="w-4 h-4" /> Retry Camera
            </Button>
          )}

          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground text-xs ml-auto"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
