"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "./login-form"
import { ForgotPasswordForm } from "./forgot-password-form"
import { ResetPasswordForm } from "./reset-password-form";
import { ParentForgotPasswordForm } from "./parent-forgot-password-form";


import { Download, Shield, User } from 'lucide-react'

import { useLanguage } from "@/lib/context/language-context"

type AuthView = "login" | "forgot-password" | "reset-password" | "parent-forgot-password";

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
        return <ForgotPasswordForm onBackToLogin={() => setCurrentView("login")} />;
      }
      if (currentView === "parent-forgot-password") {
      return <ParentForgotPasswordForm onBackToLogin={() => setCurrentView("login")} />
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
        onShowParentForgotPassword={() => setCurrentView("parent-forgot-password")}
      />
    )
  }

  return (
    <div className="auth-page-wrapper">
      {/* Full-screen Background Image */}
      <div className="auth-bg-image" />

      {/* Dark overlay for readability */}
      <div className="auth-bg-overlay" />

      {/* Main Content — vertically centered */}
      <div className="auth-content-area">
        {/* Logo + Brand above the card */}
        <div className="auth-logo-section">
          <div className="auth-logo-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bright-path-logo.png"
              alt="Bright Path Logo"
              width={88}
              height={88}
              className="auth-logo-img"
            />
          </div>
          <h1 className="auth-brand-title">BRIGHT PATH</h1>
          <p className="auth-brand-tagline">Learn &nbsp;·&nbsp; Grow &nbsp;·&nbsp; Achieve</p>
        </div>

        {/* Mobile Install Button */}
        {isInstallable && isMobile && (
          <div className="flex justify-center mb-4">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/90 backdrop-blur-sm border border-white/30 shadow-lg text-[11px] font-black uppercase tracking-[0.2em] text-[#1a3a5c]"
            >
              <Download className="w-4 h-4" />
              Install Bright Path App
            </button>
          </div>
        )}

        {/* Form Card */}
        <div className="auth-card-wrapper">
          {renderAuthForm()}
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <footer className="auth-footer">
        <div className="auth-footer-left">
          <div className="auth-footer-shield">
            <Shield className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <div className="auth-footer-brand">Bright Path School Portal</div>
            <div className="auth-footer-sub">Empowering schools for a brighter future</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-xs text-slate-400">Developed by</span>
          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-white">
            <div className="w-4 h-4 rounded-full bg-slate-700/80 flex items-center justify-center">
              <User className="w-2.5 h-2.5 text-slate-200" />
            </div>
            <span>Ethio Nova</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
