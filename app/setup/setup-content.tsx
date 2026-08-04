"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Suspense } from "react"
import { useSetupStatus, clearSetupStatusCache } from "@/lib/hooks/use-setup-status"
import { AdminSignupForm } from "@/components/auth/admin-signup-form"
import { authService } from "@/lib/auth/auth"
import { Logo } from "@/components/logo"
import { Shield, Loader2 } from "lucide-react"

// ─── Spinner fallback ──────────────────────────────────────────────────────────
function SetupSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#070d1a]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
          Checking setup status…
        </p>
      </div>
    </div>
  )
}

// ─── Inner content — runs after setup status resolves ──────────────────────────
function SetupContent() {
  const router = useRouter()
  const { setupRequired, isLoading, error } = useSetupStatus()

  // If setup is already complete, redirect to login immediately.
  useEffect(() => {
    if (!isLoading && setupRequired === false) {
      router.replace("/login")
    }
  }, [setupRequired, isLoading, router])

  // Handle successful admin creation
  const handleSignupSuccess = (userData?: any) => {
    // Invalidate cached setup status so subsequent checks reflect the new state
    clearSetupStatusCache()

    const user = userData || authService.getCurrentUser()
    const role = user?.role || "admin"

    // Redirect to appropriate dashboard
    setTimeout(() => {
      if (role === "admin" || role === "school_admin") {
        router.push("/school/admin")
      } else {
        router.push("/school/admin")
      }
    }, 50)
  }

  // Still loading — show spinner
  if (isLoading) {
    return <SetupSkeleton />
  }

  // Error state — can't determine setup status
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070d1a] p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 bg-slate-900/60 border border-red-500/20 rounded-3xl backdrop-blur-xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Connection Error</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Setup already done — show redirect notice while useEffect runs
  if (setupRequired === false) {
    return <SetupSkeleton />
  }

  // ─── Main setup UI ────────────────────────────────────────────────────────────
  return (
    <div className="auth-page min-h-screen relative overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Ambient glow background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Header badge */}
      <header className="absolute top-0 left-0 right-0 z-50 w-full px-6 py-6 flex items-center justify-between animate-in fade-in slide-in-from-top duration-700">
        <Logo size="sm" href="/" withText={true} />
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">
          <Shield className="w-3 h-3" />
          Initial Setup
        </span>
      </header>

      {/* Setup form area */}
      <div className="max-w-md w-full z-10 relative flex flex-col justify-start pt-0 -mt-10 md:-mt-20 min-h-screen">

        {/* Notice banner */}
        <div className="mb-6 mt-28 sm:mt-32 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 animate-in fade-in slide-in-from-top-4 duration-700 delay-150">
          <p className="text-xs text-indigo-300 font-semibold text-center leading-relaxed">
            🎓 Welcome! This is a one-time setup. Create the School Administrator account to get started.
          </p>
        </div>

        {/* Signup form — reuse existing AdminSignupForm */}
        <div className="w-full relative px-1 sm:px-0 animate-in fade-in zoom-in-95 duration-700 delay-200">
          <AdminSignupForm
            onSignupSuccess={handleSignupSuccess}
            onBack={() => router.replace("/login")}
            isInitialSetup={true}
          />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center animate-in fade-in duration-1000 delay-500">
          <div className="typography-label flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-slate-500 dark:text-slate-600 uppercase font-black mb-6">
            <a href="/privacy" className="hover:text-blue-400 transition-colors tracking-widest">Privacy</a>
            <a href="/terms" className="hover:text-blue-400 transition-colors tracking-widest">Terms</a>
          </div>
          <div className="text-[10px] text-slate-600/50 font-medium uppercase tracking-[0.3em]">
            &copy; {new Date().getFullYear()} Zetime &bull; Management Suite
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SetupPageContent() {
  return (
    <Suspense fallback={<SetupSkeleton />}>
      <SetupContent />
    </Suspense>
  )
}
