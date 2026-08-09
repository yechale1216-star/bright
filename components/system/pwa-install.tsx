"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X, RefreshCw } from "lucide-react"
import { notifications } from "@/lib/utils/notifications"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [swSupported, setSwSupported] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // We no longer show the prompt automatically to follow user request
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setShowManualInstructions(false)
      setDeferredPrompt(null)
      notifications.success("App Installed", "Attendance Tracker has been installed successfully!")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    if ("serviceWorker" in navigator) {
      const isPreview =
        window.location.hostname.includes("vusercontent.net") || window.location.hostname.includes("localhost")

      if (isPreview) {
        // In dev mode, just ensure any legacy service workers are unregistered
        // to avoid caching issues, without attempting to maintain a registration.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister()
          }
        }).catch(() => {})
        setSwSupported(false)
        console.log("[PWA] Service Worker registration bypassed on localhost")
      } else {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            setSwSupported(true)
            console.log("[PWA] Service Worker registered successfully")

            // Check for updates periodically
            const updateInterval = setInterval(() => {
              registration.update().catch(() => {
                // Ignore update errors if the worker unregisters itself
                clearInterval(updateInterval)
              })
            }, 60000) // Check every minute

            // Listen for updates
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    // New service worker available - skip waiting automatically
                    newWorker.postMessage({ type: "SKIP_WAITING" })
                  }
                })
              }
            })
          })
          .catch((error) => {
            console.error("[PWA] Service Worker registration failed:", error)
            setSwSupported(false)
          })
      }

      // Listen for controller change (new SW activated)
      /* 
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload()
      })
      */
    }

    // Show a one-time reminder notification on mount if not installed
    if (!isInstalled && !window.location.hostname.includes("localhost")) {
      const hasReminded = localStorage.getItem("pwa_reminded")
      if (!hasReminded) {
        notifications.info("Tip", "You can install Addis Hiwot as an app for a better experience!")
        localStorage.setItem("pwa_reminded", "true")
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [isInstalled])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        setDeferredPrompt(null)
        setShowInstallPrompt(false)
      }
    } else {
      // Show manual instructions if no native prompt available
      setShowManualInstructions(true)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    setShowManualInstructions(false)
  }

  // Don't show install prompt if already installed
  if (isInstalled) {
    return null
  }

  // Show manual instructions
  if (showManualInstructions) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="typography-label text-gray-900 mb-2">Install App</h3>
              <div className="typography-body text-gray-600 space-y-2">
                <p>
                  <strong>Chrome/Edge (Android):</strong>
                </p>
                <p>• Tap menu (⋮) → "Add to Home screen"</p>
                <p>
                  <strong>Safari (iOS):</strong>
                </p>
                <p>• Tap share (□↗) → "Add to Home Screen"</p>
                <p>
                  <strong>Desktop:</strong>
                </p>
                <p>• Look for install icon in address bar</p>
              </div>
              <Button onClick={handleDismiss} variant="outline" size="sm" className="mt-3 bg-transparent">
                Got it
              </Button>
            </div>
            <Button onClick={handleDismiss} variant="ghost" size="sm" className="ml-2 h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Show install prompt
  if (showInstallPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="typography-label text-gray-900 mb-1">Install Attendance Tracker</h3>
              <p className="typography-body text-gray-600 mb-3">
                Install this app on your device for quick access and offline use.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleInstallClick} size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Install
                </Button>
                <Button onClick={handleDismiss} variant="outline" size="sm">
                  Not now
                </Button>
              </div>
            </div>
            <Button onClick={handleDismiss} variant="ghost" size="sm" className="ml-2 h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

