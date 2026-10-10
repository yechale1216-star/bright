"use client"

import { useEffect, useState, useRef } from "react"
import { RefreshCw, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * GlobalOfflineOverlay
 * ────────────────────
 * A full-screen overlay that appears whenever the device loses internet
 * connectivity. Mounted once in app/layout.tsx so it covers every page in
 * the entire application (admin, teacher, parent, super-admin, etc.).
 *
 * On reconnection it shows a brief "Back Online" confirmation then dismisses.
 */
export function GlobalOfflineOverlay() {
  const [isOnline, setIsOnline] = useState(true)
  const [showBackOnline, setShowBackOnline] = useState(false)
  const prevOnlineRef = useRef<boolean | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Set real initial state from navigator
    setIsOnline(navigator.onLine)
    prevOnlineRef.current = navigator.onLine

    const handleOnline = () => {
      prevOnlineRef.current = true
      setIsOnline(true)
      // Show brief "Back Online" banner then auto-dismiss
      setShowBackOnline(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowBackOnline(false), 3000)
    }

    const handleOffline = () => {
      prevOnlineRef.current = false
      setIsOnline(false)
      setShowBackOnline(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Don't render anything on SSR
  if (!mounted) return null

  // ── Back-Online toast banner (YouTube green style) ──────────────────────
  if (showBackOnline && isOnline) {
    return (
      <div
        className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-[#2e7d32] text-white text-[13px] font-semibold h-11 px-4 shadow-lg animate-in slide-in-from-top duration-300"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Wifi className="h-4 w-4 shrink-0" />
        <span>Back online</span>
      </div>
    )
  }

  // ── Full-screen offline wall ─────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-950 overflow-hidden"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Subtle ambient background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-purple-500/5 blur-[100px]" />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center z-10">
          {/* Illustration */}
          <div className="mb-8">
            <WifiCloudIllustration />
          </div>

          {/* Copy */}
          <div className="space-y-3 max-w-sm mb-10">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              No Internet Connection
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Please check your Wi-Fi or mobile data and try again. Your data is safe and will sync automatically when you reconnect.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <Button
              onClick={() => {
                // Force browser to re-check connectivity
                // setIsOnline will be updated by the native event
                if (navigator.onLine) {
                  setIsOnline(true)
                  setShowBackOnline(true)
                  if (timerRef.current) clearTimeout(timerRef.current)
                  timerRef.current = setTimeout(() => setShowBackOnline(false), 3000)
                }
              }}
              className="bg-[#4f46e5] hover:bg-[#4338ca] active:bg-[#3730a3] text-white font-bold rounded-2xl h-12 w-full transition-all active:scale-[0.97] flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Dismiss the overlay and let the user browse cached content
                // The online/offline events will still fire if connectivity changes
                setIsOnline(true)
              }}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl h-12 w-full transition-all hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-[0.97] flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              Work Offline
            </Button>
          </div>

          {/* Status dot */}
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600 font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Device is offline
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 text-[11px] text-slate-400 dark:text-slate-700 font-medium z-10">
          © 2026 Bright Path · Your data is stored securely
        </div>
      </div>
    )
  }

  return null
}

// ── Inline SVG illustration (same style as DataStateView) ─────────────────

function WifiCloudIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-48 h-48 drop-shadow-[0_12px_24px_rgba(99,102,241,0.12)]"
    >
      <defs>
        <linearGradient id="gcl" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eff6ff" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
        <linearGradient id="gwf" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* Soft background glow */}
      <ellipse cx="100" cy="115" rx="52" ry="20" fill="#a5b4fc" opacity="0.25" />

      {/* Cloud body */}
      <path
        d="M60 130 C45 130 35 120 35 105 C35 91 46 81 60 80 C65 60 81 45 100 45 C119 45 135 60 140 80 C154 81 165 91 165 105 C165 120 155 130 140 130 Z"
        fill="url(#gcl)"
      />

      {/* Wifi arcs inside cloud */}
      <path d="M85 92 A20 20 0 0 1 115 92" stroke="url(#gwf)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M75 80 A35 35 0 0 1 125 80" stroke="url(#gwf)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="100" cy="104" r="5" fill="#4f46e5" />

      {/* Red X badge */}
      <circle cx="140" cy="133" r="22" fill="#ef4444" opacity="0.15" />
      <circle cx="140" cy="133" r="17" fill="#ef4444" />
      <path d="M133 126 L147 140 M147 126 L133 140" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
