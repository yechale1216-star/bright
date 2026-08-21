"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "./login-form"
import { ForgotPasswordForm } from "./forgot-password-form"
import { ResetPasswordForm } from "./reset-password-form"


import { Download } from 'lucide-react'

import { useLanguage } from "@/lib/context/language-context"

type AuthView = "login" | "forgot-password" | "reset-password"

interface AuthWrapperProps {
  onAuthSuccess: () => void
  defaultView?: AuthView
}

import { DeveloperBrand } from "@/components/developer-brand"

export function AuthWrapper({ onAuthSuccess, defaultView = "login" }: AuthWrapperProps) {
  const { t } = useLanguage()
  const [currentView, setCurrentView] = useState<AuthView>(defaultView)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if there's a reset token in the URL
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get("reset-token")
    if (token) {
      setResetToken(token)
      setCurrentView("reset-password")
    }

    // Detect screen size
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstallable(false)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    // Check if app is already installed in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
       setIsInstallable(false)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
      setIsInstallable(false)
    }
  }

  const handleResetSuccess = () => {
    // Clear the token from URL and redirect to login
    window.history.replaceState({}, document.title, window.location.pathname)
    setResetToken(null)
    setCurrentView("login")
  }

  const renderAuthForm = () => {
    if (currentView === "forgot-password") {
      return <ForgotPasswordForm onBackToLogin={() => setCurrentView("login")} />
    }

    if (currentView === "reset-password" && resetToken) {
      return <ResetPasswordForm token={resetToken} onResetSuccess={handleResetSuccess} />
    }

    // Default: standard login form
    // NOTE: onShowAdminSignup is intentionally NOT passed — in the single-school
    // edition, account creation is only available during initial setup (/setup)
    // or by the School Administrator through the user management interface.
    return (
      <LoginForm
        onLoginSuccess={onAuthSuccess}
        onShowForgotPassword={() => setCurrentView("forgot-password")}
      />
    )
  }

  return (
    <div className="auth-page min-h-screen relative overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Auth Form */}
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-1000 z-10 relative flex flex-col justify-center py-6 sm:py-10">

        {/* Mobile Install Button */}
        {isInstallable && isMobile && (
          <div className="flex justify-center mb-6">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-lg text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400"
            >
              <Download className="w-4 h-4" />
              Install Addis Hiwot App
            </button>
          </div>
        )}

        <div className="w-full relative px-1 sm:px-0">
          {renderAuthForm()}
        </div>

        <div className="mt-8 text-center animate-in fade-in duration-1000 delay-500 flex flex-col items-center gap-2.5">
          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} Addis Hiwot &bull; Management Suite
          </div>
          <DeveloperBrand type="developed" />
        </div>
      </div>
    </div>
  )
}
