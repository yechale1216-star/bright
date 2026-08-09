'use client'

import React, { useEffect, useState } from 'react'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/lib/context/auth-context'
import { Loader2 } from 'lucide-react'

export function StartupLoadingScreen() {
  const { sessionReady } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setMounted(true)

    // Instantly hide native Android/Capacitor splash screen
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch((err) =>
        console.warn('[StartupLoadingScreen] Failed to hide native splash:', err)
      )
    }
  }, [])

  useEffect(() => {
    if (mounted && sessionReady) {
      setIsVisible(false)
    }
  }, [sessionReady, mounted])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-opacity duration-300">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-9 h-9 text-blue-600 dark:text-blue-400 animate-spin" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-wide animate-pulse">
          Loading Addis Hiwot...
        </p>
      </div>
    </div>
  )
}
