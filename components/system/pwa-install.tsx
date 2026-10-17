"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X, Smartphone, Check, Sparkles } from "lucide-react"
import { notifications } from "@/lib/utils/notifications"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

// Global state for install prompt so any component can trigger installation
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

function notifyPromptListeners() {
  promptListeners.forEach((fn) => fn())
}

export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const checkStandalone = () => {
      const isApp =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
      setIsStandalone(Boolean(isApp))
    }

    checkStandalone()
    setCanInstall(Boolean(globalDeferredPrompt))

    const handleUpdate = () => {
      setCanInstall(Boolean(globalDeferredPrompt))
    }

    promptListeners.add(handleUpdate)
    return () => {
      promptListeners.delete(handleUpdate)
    }
  }, [])

  const triggerInstall = async () => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt()
        const choice = await globalDeferredPrompt.userChoice
        if (choice.outcome === "accepted") {
          globalDeferredPrompt = null
          notifyPromptListeners()
          notifications.success("Installing App", "Thank you for installing Bright Path!")
        }
      } catch (err) {
        console.warn("[PWA] Prompt error:", err)
      }
    } else {
      window.dispatchEvent(new CustomEvent("zetime:show-pwa-instructions"))
    }
  }

  return { canInstall, isStandalone, triggerInstall }
}

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // 1. Check if already running standalone
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true

    if (isStandaloneMode) {
      setIsInstalled(true)
      return
    }

    // 2. Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[PWA] Service Worker active with scope:", registration.scope)

          // Check for service worker updates periodically
          const updateInterval = setInterval(() => {
            registration.update().catch(() => clearInterval(updateInterval))
          }, 5 * 60 * 1000)

          // Auto-activate waiting worker
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: "SKIP_WAITING" })
                }
              })
            }
          })
        })
        .catch((error) => {
          console.warn("[PWA] Service Worker registration:", error)
        })
    }

    // 3. Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      globalDeferredPrompt = promptEvent
      setDeferredPrompt(promptEvent)
      notifyPromptListeners()

      // Show polite banner if not dismissed recently
      try {
        const dismissedAt = localStorage.getItem("bp_pwa_dismissed_at")
        const oneDay = 24 * 60 * 60 * 1000
        if (!dismissedAt || Date.now() - parseInt(dismissedAt, 10) > oneDay * 3) {
          setShowBanner(true)
        }
      } catch {
        setShowBanner(true)
      }
    }

    // 4. Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowBanner(false)
      setShowManualInstructions(false)
      globalDeferredPrompt = null
      setDeferredPrompt(null)
      notifyPromptListeners()
      notifications.success("App Installed", "Bright Path has been installed on your device!")
    }

    // 5. Custom event to open instructions from anywhere
    const handleOpenInstructions = () => {
      setShowManualInstructions(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    window.addEventListener("zetime:show-pwa-instructions", handleOpenInstructions)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      window.removeEventListener("zetime:show-pwa-instructions", handleOpenInstructions)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt || globalDeferredPrompt) {
      const activePrompt = deferredPrompt || globalDeferredPrompt
      try {
        await activePrompt?.prompt()
        const choice = await activePrompt?.userChoice
        if (choice?.outcome === "accepted") {
          globalDeferredPrompt = null
          setDeferredPrompt(null)
          notifyPromptListeners()
          setShowBanner(false)
        }
      } catch (err) {
        console.warn("[PWA] Install error:", err)
      }
    } else {
      setShowManualInstructions(true)
    }
  }

  const handleDismissBanner = () => {
    setShowBanner(false)
    try {
      localStorage.setItem("bp_pwa_dismissed_at", Date.now().toString())
    } catch {
      // storage unavailable
    }
  }

  // Already running in installed app
  if (isInstalled) {
    return null
  }

  return (
    <>
      {/* Manual Instructions Dialog */}
      {showManualInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-card border border-border text-foreground rounded-2xl shadow-2xl p-6 overflow-hidden">
            <button
              onClick={() => setShowManualInstructions(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Install Bright Path</h3>
                <p className="text-xs text-muted-foreground">Add to your device for quick access & offline use</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-foreground/80 my-4 bg-muted/50 p-4 rounded-xl border border-border/60">
              <div className="flex items-start gap-2.5">
                <span className="font-bold text-primary shrink-0">iOS (Safari):</span>
                <span>Tap the <strong>Share</strong> icon (square with arrow) at the bottom, then choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</span>
              </div>
              <div className="h-px bg-border/60" />
              <div className="flex items-start gap-2.5">
                <span className="font-bold text-primary shrink-0">Android (Chrome):</span>
                <span>Tap the three dots (⋮) in the top-right corner, then select <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</span>
              </div>
              <div className="h-px bg-border/60" />
              <div className="flex items-start gap-2.5">
                <span className="font-bold text-primary shrink-0">Desktop (Chrome/Edge):</span>
                <span>Click the <strong>Install</strong> icon in the address bar (right side) to install as a standalone app.</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualInstructions(false)}
                className="rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating polite Install Banner */}
      {showBanner && !showManualInstructions && (
        <aside
          aria-label="Install App"
          className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-6 md:max-w-md animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="bg-card/95 backdrop-blur-md border border-primary/20 text-card-foreground rounded-2xl shadow-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-foreground">Install Bright Path App</p>
                <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">PWA</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Get full-screen access, faster load times & offline support.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="h-8 px-3 rounded-xl gap-1.5 text-xs font-bold shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </Button>
              <button
                onClick={handleDismissBanner}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  )
}
