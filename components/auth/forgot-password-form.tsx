"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Logo } from "@/components/logo"
import { ArrowLeft, Mail, Phone, CheckCircle2, RefreshCw } from "lucide-react"

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
}

type Method = "email" | "phone"
type Step = "request" | "sent"

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [method, setMethod] = useState<Method>("email")
  const [identifier, setIdentifier] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<Step>("request")
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startCooldown = () => {
    setCooldown(60)
    timerRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const validateIdentifier = (): string | null => {
    const trimmed = identifier.trim()
    if (!trimmed) return `Please enter your ${method === "email" ? "email address" : "phone number"}`
    if (method === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Please enter a valid email address"
    } else {
      // Accept Ethiopian phone formats: 09..., 07..., +2519..., +2517...
      const cleaned = trimmed.replace(/[\s\-()]/g, "")
      if (!/^(\+251[79]\d{8}|0[79]\d{8})$/.test(cleaned)) {
        return "Please enter a valid phone number (e.g. 09xxxxxxxx or +2519xxxxxxxx)"
      }
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateIdentifier()
    if (validationError) {
      notifications.error("Validation Error", validationError)
      return
    }
    setIsLoading(true)
    try {
      await authService.requestPasswordReset(identifier.trim(), method)
      setStep("sent")
      startCooldown()
    } catch {
      notifications.error("Error", "An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setIsLoading(true)
    try {
      await authService.requestPasswordReset(identifier.trim(), method)
      startCooldown()
      notifications.success(
        method === "email" ? "Email Resent" : "OTP Resent",
        method === "email"
          ? "A new reset link has been sent to your inbox."
          : "A new 6-digit code has been sent to your phone."
      )
    } catch {
      notifications.error("Error", "Failed to resend. Please try again shortly.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Sent / Confirmation State ──────────────────────────────────────────────
  if (step === "sent") {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="text-center pt-9 pb-4 px-8">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">
            {method === "email" ? "Check Your Email" : "Check Your Phone"}
          </h2>
          <CardDescription className="typography-label text-slate-600 dark:text-slate-400">
            {method === "email"
              ? "Reset instructions sent to your inbox"
              : "A 6-digit reset code was sent via SMS"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 text-center space-y-5">
          <p className="typography-body text-slate-800 dark:text-slate-300">
            {method === "email" ? (
              <>Instructions sent to <strong className="text-slate-900 dark:text-white">{identifier}</strong>. Follow the link in the email to reset your password.</>
            ) : (
              <>A 6-digit code was sent to <strong className="text-slate-900 dark:text-white">{identifier}</strong>. Use it on the reset page to set a new password.</>
            )}
          </p>

          {method === "phone" && (
            <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-200 dark:border-blue-500/20 text-left">
              <p className="text-[12px] text-blue-700 dark:text-blue-300 font-semibold">
                📱 Next step: Go to the <strong>Reset Password</strong> page, enter your phone number, the 6-digit code, and your new password.
              </p>
            </div>
          )}

          <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="text-[11px] text-slate-500 dark:text-slate-500 italic font-medium leading-relaxed">
              {method === "email"
                ? "Didn't receive the email? Check your spam folder or try again."
                : "Didn't receive the SMS? Make sure the number is correct, then try again."}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {method === "phone" && (
              <Button
                onClick={() => window.location.href = "/reset-password"}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all font-bold"
              >
                Go to Reset Password Page
              </Button>
            )}
            <button
              onClick={handleResend}
              disabled={cooldown > 0 || isLoading}
              className="flex items-center justify-center gap-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : isLoading
                  ? "Resending..."
                  : `Resend ${method === "email" ? "Email" : "OTP"}`}
            </button>
          </div>

          <Button
            variant="outline"
            onClick={onBackToLogin}
            className="w-full h-12 rounded-xl bg-slate-100 dark:bg-transparent border-slate-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/5 hover:border-slate-400 dark:hover:border-white/20 transition-all font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Request Form ─────────────────────────────────────────────────────────────
  return (
    <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
      <CardHeader className="space-y-4 pb-6 pt-9 px-8 text-center relative flex flex-col items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBackToLogin}
          className="absolute left-4 top-4 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          id="back-to-login-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Logo size="xl" withText={true} href="/" className="mb-2" />
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">
          Reset Password
        </h2>
        <CardDescription className="typography-label text-slate-600 dark:text-slate-400">
          Choose how to receive your reset instructions
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-8">
        {/* Method Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 mb-6 bg-slate-100 dark:bg-white/5 p-1 gap-1">
          {(["email", "phone"] as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              id={`method-tab-${m}`}
              onClick={() => { setMethod(m); setIdentifier("") }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200
                ${method === m
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              {m === "email" ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              {m === "email" ? "Email" : "Phone Number"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-identifier" className="text-slate-800 dark:text-slate-300">
              {method === "email" ? "Email Address" : "Phone Number"}
            </Label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
                {method === "email" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </div>
              <Input
                id="reset-identifier"
                type={method === "email" ? "email" : "tel"}
                placeholder={method === "email" ? "name@school.com" : "09xxxxxxxx or +2519xxxxxxxx"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete={method === "email" ? "email" : "tel"}
                className="pl-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
              />
            </div>
            {method === "phone" && (
              <p className="text-[11px] text-slate-500 dark:text-slate-500 pl-1">
                You'll receive a 6-digit OTP on this number (valid for 15 minutes).
              </p>
            )}
          </div>

          <Button
            type="submit"
            id="send-reset-btn"
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="text-white mr-2" />
                Sending...
              </>
            ) : (
              method === "email" ? "Send Reset Link" : "Send OTP"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-300 dark:border-white/5 text-center">
          <Button
            variant="link"
            onClick={onBackToLogin}
            className="text-blue-700 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 p-0 h-auto font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
