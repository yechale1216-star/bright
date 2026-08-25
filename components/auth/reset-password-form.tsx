"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Logo } from "@/components/logo"
import { Eye, EyeOff, CheckCircle2, Lock, XCircle, Phone, Mail } from "lucide-react"

type FlowMode = "email" | "phone"
type PhoneStep = "phone-otp" | "phone-password"

interface ResetPasswordFormProps {
  token?: string
  onResetSuccess: () => void
}

function PasswordMatchIndicator({ password, confirm }: { password: string; confirm: string }) {
  if (!password || !confirm) return null
  const match = password === confirm
  return (
    <div className={`typography-helper flex items-center p-2 rounded-lg border animate-in fade-in duration-200 ${
      match
        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        : "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20"
    }`}>
      {match
        ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Passwords match</>
        : <><XCircle className="w-3.5 h-3.5 mr-1.5" />Passwords do not match</>}
    </div>
  )
}

function PasswordFields({
  password, setPassword, confirmPassword, setConfirmPassword, isLoading
}: {
  password: string; setPassword: (v: string) => void
  confirmPassword: string; setConfirmPassword: (v: string) => void
  isLoading: boolean
}) {
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-slate-800 dark:text-slate-300">New Password</Label>
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
            <Lock className="w-4 h-4" />
          </div>
          <Input
            id="new-password"
            type={showPw ? "text" : "password"}
            placeholder="Enter new password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={isLoading}
            className="pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-slate-800 dark:text-slate-300">Confirm New Password</Label>
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
            <Lock className="w-4 h-4" />
          </div>
          <Input
            id="confirm-password"
            type={showCpw ? "text" : "password"}
            placeholder="Confirm your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            disabled={isLoading}
            className="pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
          />
          <button
            type="button"
            onClick={() => setShowCpw(!showCpw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {showCpw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <PasswordMatchIndicator password={password} confirm={confirmPassword} />
    </>
  )
}

export function ResetPasswordForm({ token, onResetSuccess }: ResetPasswordFormProps) {
  const [mode, setMode] = useState<FlowMode>(token ? "email" : "phone")
  const [tokenValid, setTokenValid] = useState<boolean | null>(token ? null : true)
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("phone-otp")

  // Email flow state
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Phone flow state
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [verifiedOtp, setVerifiedOtp] = useState("")

  const [isLoading, setIsLoading] = useState(false)

  // Verify email token on mount if token is provided
  useEffect(() => {
    if (!token) return
    const verify = async () => {
      try {
        const result = await authService.verifyResetToken(token)
        setTokenValid(result.valid)
        if (!result.valid) {
          notifications.error("Invalid Token", "This reset link is invalid or has expired.")
        }
      } catch {
        setTokenValid(false)
        notifications.error("Error", "Unable to verify reset token.")
      }
    }
    verify()
  }, [token])

  // ── Email: Token invalid / loading states ──────────────────────────────────
  if (token && tokenValid === null) {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-pulse relative z-10">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Spinner size="md" className="text-primary" />
          <p className="typography-label text-slate-600 dark:text-slate-400">Verifying reset link...</p>
        </CardContent>
      </Card>
    )
  }

  if (token && tokenValid === false) {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border relative z-10">
        <CardHeader className="text-center pt-9 pb-4 px-8">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 tracking-tight leading-none pt-2">Invalid Reset Link</h2>
          <CardDescription className="typography-label text-slate-600 dark:text-slate-400">This link is invalid or has expired</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 text-center space-y-6">
          <p className="typography-body text-slate-800 dark:text-slate-300">
            Password reset links expire after 15 minutes for security. Please request a new one.
          </p>
          <Button
            onClick={() => window.location.href = "/login"}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all font-bold"
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Email flow: password entry ──────────────────────────────────────────────
  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !confirmPassword) {
      notifications.error("Validation Error", "Please fill in all fields")
      return
    }
    if (password !== confirmPassword) {
      notifications.error("Validation Error", "Passwords do not match")
      return
    }
    if (password.length < 6) {
      notifications.error("Validation Error", "Password must be at least 6 characters")
      return
    }
    setIsLoading(true)
    try {
      const result = await authService.resetPassword({ token: token!, password })
      if (result.success) {
        notifications.success("Password Reset", "Your password has been successfully reset!")
        onResetSuccess()
      } else {
        notifications.error("Reset Failed", result.error || result.message || "Failed to reset password")
      }
    } catch {
      notifications.error("Error", "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Phone flow: OTP verify ──────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (!phone.trim() || otp.length !== 6) {
      setOtpError("Please enter your phone number and the 6-digit OTP.")
      return
    }
    setOtpVerifying(true)
    setOtpError(null)
    try {
      const result = await authService.verifyResetOTP(phone.trim(), otp)
      if (result.valid) {
        setVerifiedOtp(otp)
        setPhoneStep("phone-password")
      } else {
        setOtpError(result.message || "Invalid or expired OTP. Please try again.")
      }
    } catch {
      setOtpError("Network error. Please try again.")
    } finally {
      setOtpVerifying(false)
    }
  }

  // ── Phone flow: password entry ──────────────────────────────────────────────
  const handlePhoneReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !confirmPassword) {
      notifications.error("Validation Error", "Please fill in all fields")
      return
    }
    if (password !== confirmPassword) {
      notifications.error("Validation Error", "Passwords do not match")
      return
    }
    if (password.length < 6) {
      notifications.error("Validation Error", "Password must be at least 6 characters")
      return
    }
    setIsLoading(true)
    try {
      const result = await authService.resetPassword({ phone: phone.trim(), otp: verifiedOtp, password })
      if (result.success) {
        notifications.success("Password Reset", "Your password has been successfully reset!")
        onResetSuccess()
      } else {
        notifications.error("Reset Failed", result.error || result.message || "Failed to reset password")
      }
    } catch {
      notifications.error("Error", "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
      <CardHeader className="space-y-4 pb-6 pt-9 px-8 text-center relative flex flex-col items-center">
        <Logo size="xl" withText={true} href="/" className="mb-2" />
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">
          Set New Password
        </h2>
        <CardDescription className="typography-label text-slate-600 dark:text-slate-400">
          {mode === "email"
            ? "Create a secure new password for your account"
            : phoneStep === "phone-otp"
              ? "Enter your phone number and the OTP you received"
              : "OTP verified — set your new password"}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-8">
        {/* Mode tabs — only show when no email token is provided */}
        {!token && (
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 mb-6 bg-slate-100 dark:bg-white/5 p-1 gap-1">
            {(["email", "phone"] as FlowMode[]).map((m) => (
              <button
                key={m}
                type="button"
                id={`reset-mode-${m}`}
                onClick={() => { setMode(m); setPassword(""); setConfirmPassword(""); setOtp(""); setOtpError(null); setPhoneStep("phone-otp"); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold transition-all duration-200
                  ${mode === m
                    ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                {m === "email" ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                {m === "email" ? "Email Token" : "Phone OTP"}
              </button>
            ))}
          </div>
        )}

        {/* ── Email flow ── */}
        {mode === "email" && (
          <form onSubmit={handleEmailReset} className="space-y-5">
            <PasswordFields
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              isLoading={isLoading}
            />
            <Button
              type="submit"
              id="reset-password-btn"
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
              disabled={isLoading || password !== confirmPassword || password.length < 6}
            >
              {isLoading ? (
                <><Spinner size="sm" className="text-white mr-2" />Resetting...</>
              ) : "Reset Password"}
            </Button>
          </form>
        )}

        {/* ── Phone flow: OTP entry ── */}
        {mode === "phone" && phoneStep === "phone-otp" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-phone" className="text-slate-800 dark:text-slate-300">Phone Number</Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
                  <Phone className="w-4 h-4" />
                </div>
                <Input
                  id="reset-phone"
                  type="tel"
                  placeholder="09xxxxxxxx or +2519xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-800 dark:text-slate-300">6-Digit OTP Code</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(val) => { setOtp(val); setOtpError(null) }}
                  id="reset-otp-input"
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="w-11 h-12 text-base font-bold border-slate-300 dark:border-white/20 bg-slate-100/50 dark:bg-white/5 text-slate-900 dark:text-white focus:border-blue-600 focus:ring-blue-500/20 rounded-lg"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {otpError && (
                <p className="text-[12px] text-red-600 dark:text-red-400 text-center animate-in fade-in duration-200">
                  {otpError}
                </p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-500 text-center">
                Enter the code sent to your phone. It expires in 15 minutes.
              </p>
            </div>

            <Button
              type="button"
              id="verify-otp-btn"
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || !phone.trim() || otpVerifying}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              {otpVerifying
                ? <><Spinner size="sm" className="text-white mr-2" />Verifying...</>
                : "Verify OTP"}
            </Button>

            <p className="text-center text-[12px] text-slate-500 dark:text-slate-500">
              Didn&apos;t receive a code?{" "}
              <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                Go back and request a new OTP
              </a>
            </p>
          </div>
        )}

        {/* ── Phone flow: password entry (OTP verified) ── */}
        {mode === "phone" && phoneStep === "phone-password" && (
          <form onSubmit={handlePhoneReset} className="space-y-5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-[13px] font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              OTP verified — set your new password below
            </div>
            <PasswordFields
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              isLoading={isLoading}
            />
            <Button
              type="submit"
              id="phone-reset-password-btn"
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
              disabled={isLoading || password !== confirmPassword || password.length < 6}
            >
              {isLoading
                ? <><Spinner size="sm" className="text-white mr-2" />Resetting...</>
                : "Reset Password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
