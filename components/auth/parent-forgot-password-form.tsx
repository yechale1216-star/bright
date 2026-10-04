"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { ArrowLeft, CheckCircle2, Lock, Eye, EyeOff, MessageSquare, ArrowRight, XCircle } from "lucide-react"
import { Logo } from "@/components/logo"
import { PhoneInput } from "@/components/ui/phone-input"
import { Spinner } from "@/components/ui/spinner"
import { validatePassword, PASSWORD_REQUIREMENTS } from "@/lib/utils/password-validator"

interface ParentForgotPasswordFormProps {
  onBackToLogin: () => void;
}

const OTP_LENGTH = 6;

export function ParentForgotPasswordForm({ onBackToLogin }: ParentForgotPasswordFormProps) {
  const [step, setStep] = useState<"phone" | "otp" | "new-password" | "success">("phone");
  const [phone, setPhone] = useState("+251");
  const [otpCode, setOtpCode] = useState("");
  // Individual digit boxes
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Keep otpCode in sync with digit boxes
  useEffect(() => {
    setOtpCode(digits.join(""));
  }, [digits]);

  // Auto-focus first digit box when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      const timer = setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        digitRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    digitRefs.current[focusIdx]?.focus();
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s+/g, "");
    if (!cleanPhone || cleanPhone === "+251") {
      notifications.error("Validation Error", "Please enter your registered Ethiopian phone number.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.parentForgotPassword(cleanPhone);
      if (result.success) {
        setStep("otp");
        setResendCooldown(60);
        notifications.success("Verification Code Sent", "We have dispatched a verification code via SMS.");
      } else {
        notifications.error("Request Failed", result.message || "Unable to send verification code.");
      }
    } catch (err: any) {
      notifications.error("Error", "Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || isLoading) return;
    const cleanPhone = phone.replace(/\s+/g, "");
    setIsLoading(true);
    try {
      const result = await authService.parentForgotPassword(cleanPhone);
      if (result.success) {
        setResendCooldown(60);
        notifications.success("Code Resent", "A new verification code has been dispatched via SMS.");
      } else {
        notifications.error("Failed to Resend", result.message || "Unable to resend verification code.");
      }
    } catch (err) {
      notifications.error("Error", "Network error while resending SMS.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s+/g, "");
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      notifications.error("Validation Error", "Please enter the verification code sent to your phone.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.verifyParentOTP(cleanPhone, cleanCode);
      if (result.success) {
        notifications.success("Code Verified", "Your identity has been confirmed. Now set your new password.");
        setStep("new-password");
      } else {
        notifications.error("Verification Failed", result.message || "Invalid or expired code. Please try again.");
      }
    } catch (err) {
      notifications.error("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s+/g, "");
    const cleanCode = otpCode.trim();
    if (!newPassword) {
      notifications.error("Validation Error", "Please enter a new password.");
      return;
    }
    const pv = validatePassword(newPassword);
    if (!pv.isValid) {
      notifications.error("Password Requirements", pv.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      notifications.error("Validation Error", "Passwords do not match. Please re-enter.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.resetParentPassword(cleanPhone, cleanCode, newPassword);
      if (result.success) {
        setStep("success");
        notifications.success("Password Updated", "Your password has been successfully reset.");
      } else {
        notifications.error("Reset Failed", result.message || "Failed to reset password. Please start over.");
      }
    } catch (err) {
      notifications.error("Error", "An unexpected error occurred during password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in zoom-in-95 duration-500 relative z-10">
        <div className="text-center pt-9 pb-4 px-8">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Password Reset Complete</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Your parent account password has been updated. You can now sign in using your new credentials.</p>
        </div>
        <CardContent className="px-8 pb-8 pt-4 text-center">
          <Button onClick={onBackToLogin} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]">
            Sign In with New Password
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "new-password") {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-400 relative z-10">
        <CardHeader className="space-y-4 pb-4 pt-8 px-8 text-center relative flex flex-col items-center">
          <Button variant="ghost" size="icon" onClick={() => setStep("otp")} className="absolute left-4 top-4 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Button>
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
            <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Set New Password</h2>
            <CardDescription className="typography-label text-slate-600 dark:text-slate-400 mt-1">Create a secure new password for your account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="typography-label text-slate-800 dark:text-slate-300">New Password</Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Lock className="w-4 h-4" /></div>
                <Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="Min. 8 chars (A-Z, a-z, 0-9)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="typography-body pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white rounded-xl" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">{PASSWORD_REQUIREMENTS}</p>
            </div>

            {/* Live validation feedback */}
            {newPassword && (() => {
              const pv = validatePassword(newPassword);
              return (
                <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  {[
                    { label: "8+ characters", ok: pv.hasMinLength },
                    { label: "Uppercase (A–Z)", ok: pv.hasUppercase },
                    { label: "Lowercase (a–z)", ok: pv.hasLowercase },
                    { label: "Number (0–9)", ok: pv.hasNumber },
                  ].map(({ label, ok }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                      {label}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="typography-label text-slate-800 dark:text-slate-300">Confirm New Password</Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Lock className="w-4 h-4" /></div>
                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="typography-body pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white rounded-xl" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Match status */}
            {confirmPassword && newPassword !== confirmPassword && (
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                Passwords do not match
              </div>
            )}
            {newPassword && confirmPassword && newPassword === confirmPassword && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Passwords match
              </div>
            )}

            <Button type="submit" disabled={isLoading || !newPassword || !confirmPassword || !validatePassword(newPassword).isValid || newPassword !== confirmPassword} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] mt-2">
              {isLoading ? <Spinner size="sm" className="text-white" /> : "Set New Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === "otp") {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
        <CardHeader className="space-y-4 pb-4 pt-8 px-8 text-center relative flex flex-col items-center">
          <Button variant="ghost" size="icon" onClick={() => setStep("phone")} className="absolute left-4 top-4 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Button>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Verify SMS Code</h2>
            <CardDescription className="typography-label text-slate-600 dark:text-slate-400 mt-1">
              Enter the verification code sent to <strong className="text-slate-900 dark:text-white">{phone}</strong>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div className="space-y-2">
              <Label className="typography-label text-slate-800 dark:text-slate-300 text-center block">Verification Code (OTP)</Label>
              <div className="flex items-center justify-center gap-2" onPaste={handleDigitPaste}>
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { digitRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    autoFocus={i === 0}
                    className="w-11 h-13 text-center text-xl font-black font-mono rounded-xl border-2 bg-slate-100/60 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all caret-transparent"
                    style={{ width: '2.75rem', height: '3.25rem' }}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] mt-2">
              {isLoading ? <Spinner size="sm" className="text-white" /> : <><span>Verify Code</span><ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            <div className="flex items-center justify-between pt-2 text-xs">
              <button type="button" onClick={() => setStep("phone")} className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium">Change phone number</button>
              <button type="button" disabled={resendCooldown > 0 || isLoading} onClick={handleResendOTP} className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold disabled:opacity-50 disabled:no-underline">
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend SMS"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
      <CardHeader className="space-y-4 pb-6 pt-9 px-8 text-center relative flex flex-col items-center">
        <Button variant="ghost" size="icon" onClick={onBackToLogin} className="absolute left-4 top-4 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </Button>
        <Logo size="xl" withText={true} href="/" className="mb-2" />
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Reset Parent Password</h2>
        <CardDescription className="typography-label text-slate-600 dark:text-slate-400 max-w-xs">
          Enter your registered Ethiopian phone number to receive a verification code via SMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleRequestOTP} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="parentPhone" className="typography-label text-slate-800 dark:text-slate-300">Registered Phone Number</Label>
            <PhoneInput id="parentPhone" value={phone} onChange={(val) => setPhone(val)} placeholder="9XXXXXXXX" required />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]">
            {isLoading ? <Spinner size="sm" className="text-white" /> : <><span>Send Verification Code</span><ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
          <div className="text-center pt-2">
            <button type="button" onClick={onBackToLogin} className="text-xs text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold">
              Remember your password? Sign In
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
