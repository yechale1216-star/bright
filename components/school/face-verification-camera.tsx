"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Sparkles } from "lucide-react"
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
  const [isCapturing, setIsCapturing] = useState(false)
  const [scanStatus, setScanStatus] = useState<
    "initializing" | "ready" | "detecting" | "multiple_faces" | "matched" | "mismatched" | "no_face" | "error"
  >("initializing")
  const [statusMessage, setStatusMessage] = useState("Initializing camera & face models...")
  const [matchScore, setMatchScore] = useState<number | null>(null)

  const { isModelsLoaded, isLoadingModels, loadError, loadModels, detectFaceFromVideo, verifyFaceMatch } =
    useFaceRecognition()

  // 1. Initialize face recognition models
  useEffect(() => {
    loadModels()
  }, [loadModels])

  // 2. Start webcam stream
  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScanStatus("initializing")
    setStatusMessage("Opening camera...")

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

      setScanStatus("ready")
      setStatusMessage(
        mode === "enroll"
          ? "Position face inside frame and look directly at camera"
          : "Position face inside frame to verify attendance"
      )
    } catch (err: any) {
      console.error("[FaceCamera] Camera error:", err)
      const errorMsg =
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please grant camera access."
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
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // 3. Continuous / on-demand scanning loop
  const processFrame = useCallback(async () => {
    if (!videoRef.current || !isModelsLoaded || isCapturing) return
    setIsCapturing(true)
    setScanStatus("detecting")
    setStatusMessage("Analyzing face...")

    try {
      const detection: FaceDetectionResult = await detectFaceFromVideo(videoRef.current)

      if (detection.multipleFaces) {
        setScanStatus("multiple_faces")
        setStatusMessage("Multiple faces detected! Please ensure only one person is visible.")
        NativeBridge.vibrate(ImpactStyle.Heavy)
        setIsCapturing(false)
        return
      }

      if (!detection.detected || !detection.descriptor) {
        setScanStatus("no_face")
        setStatusMessage("No face detected. Please face the camera directly.")
        setIsCapturing(false)
        return
      }

      // If in ENROLL mode:
      if (mode === "enroll") {
        setScanStatus("matched")
        setStatusMessage("Face successfully captured!")
        NativeBridge.vibrate(ImpactStyle.Light)
        if (onVerified) {
          onVerified({ descriptor: detection.descriptor, confidence: 1.0 })
        }
        setIsCapturing(false)
        return
      }

      // If in VERIFY mode:
      if (mode === "verify") {
        if (!enrolledDescriptor || enrolledDescriptor.length === 0) {
          setScanStatus("mismatched")
          setStatusMessage("No enrolled face on record for this staff member.")
          NativeBridge.vibrate(ImpactStyle.Heavy)
          if (onFailed) onFailed("Staff has no enrolled biometric face record.")
          setIsCapturing(false)
          return
        }

        const matchResult: FaceMatchResult = verifyFaceMatch(detection.descriptor, enrolledDescriptor)
        setMatchScore(matchResult.confidence)

        if (matchResult.isMatch) {
          setScanStatus("matched")
          setStatusMessage(`Face Verified! Match confidence: ${(matchResult.confidence * 100).toFixed(0)}%`)
          NativeBridge.vibrate(ImpactStyle.Light)
          if (onVerified) {
            onVerified({ descriptor: detection.descriptor, confidence: matchResult.confidence })
          }
        } else {
          setScanStatus("mismatched")
          setStatusMessage(
            `Face mismatch (Confidence: ${(matchResult.confidence * 100).toFixed(0)}%). Please try again.`
          )
          NativeBridge.vibrate(ImpactStyle.Heavy)
          if (onFailed) onFailed("Face verification failed: identity mismatch.")
        }
      }
    } catch (err: any) {
      console.error("[FaceCamera] Verification error:", err)
      setScanStatus("error")
      setStatusMessage("Verification error. Please retry.")
    } finally {
      setIsCapturing(false)
    }
  }, [
    isModelsLoaded,
    isCapturing,
    detectFaceFromVideo,
    mode,
    enrolledDescriptor,
    verifyFaceMatch,
    onVerified,
    onFailed,
  ])

  return (
    <Card className="w-full max-w-md mx-auto border-border/60 shadow-xl overflow-hidden backdrop-blur-sm bg-card/95">
      <CardContent className="p-4 flex flex-col items-center gap-4">
        {/* Camera Viewport with Biometric Overlay */}
        <div className="relative w-full aspect-[4/3] bg-neutral-950 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-inner flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Oval HUD */}
          <div
            className={`absolute inset-6 border-2 border-dashed rounded-[45%] pointer-events-none transition-all duration-300 ${
              scanStatus === "matched"
                ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                : scanStatus === "mismatched" || scanStatus === "multiple_faces" || scanStatus === "error"
                ? "border-rose-500 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.3)]"
                : scanStatus === "detecting"
                ? "border-amber-400 bg-amber-400/5 animate-pulse"
                : "border-primary/50"
            }`}
          >
            {/* Top / Bottom scan guide markers */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary/40 rounded-full" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary/40 rounded-full" />
          </div>

          {/* Status Badge in Viewport */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <Badge
              variant="outline"
              className={`backdrop-blur-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                scanStatus === "matched"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-500"
                  : scanStatus === "mismatched" || scanStatus === "multiple_faces"
                  ? "bg-rose-950/80 text-rose-300 border-rose-500"
                  : "bg-black/70 text-neutral-200 border-neutral-700"
              }`}
            >
              {mode === "enroll" ? "Biometric Enrollment" : "Biometric Check"}
            </Badge>

            {matchScore !== null && (
              <Badge className="bg-emerald-600 text-white text-xs">
                {(matchScore * 100).toFixed(0)}% Match
              </Badge>
            )}
          </div>
        </div>

        {/* Real-Time Inline Status Feedback (No Toast Spam) */}
        <div className="w-full text-center px-2 py-1.5 rounded-lg bg-muted/50 border border-border/40">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            {scanStatus === "matched" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
            {(scanStatus === "mismatched" || scanStatus === "error") && (
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            {(scanStatus === "multiple_faces" || scanStatus === "no_face") && (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {scanStatus === "detecting" && <Sparkles className="w-4 h-4 text-primary animate-spin shrink-0" />}
            {scanStatus === "ready" && <Camera className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span
              className={
                scanStatus === "matched"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : scanStatus === "mismatched" || scanStatus === "error"
                  ? "text-rose-600 dark:text-rose-400"
                  : scanStatus === "multiple_faces"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-foreground"
              }
            >
              {statusMessage}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="w-full flex items-center gap-2">
          {scanStatus !== "matched" && (
            <Button
              type="button"
              onClick={processFrame}
              disabled={!isModelsLoaded || isCapturing || scanStatus === "error"}
              className="flex-1 font-semibold gap-2 shadow-md"
            >
              {isCapturing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  {mode === "enroll" ? "Capture Face" : "Verify Face"}
                </>
              )}
            </Button>
          )}

          {scanStatus === "error" && (
            <Button type="button" variant="outline" onClick={startCamera} className="gap-1.5">
              <RefreshCw className="w-4 h-4" /> Retry Camera
            </Button>
          )}

          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
