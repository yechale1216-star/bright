"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  User,
  Phone,
  KeyRound,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studentDb } from "@/lib/db/student-db";

export default function StudentForgotPasswordPage() {
  const router = useRouter();

  // Wizard step: 1 | 2 | 3 | 4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form values
  const [studentId, setStudentId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(45);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    let timer: any = null;
    if (step === 2 && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendTimer]);

  // Password validation checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  // Step 1: Submit Student ID
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!studentId.trim()) {
      setError("Please enter your Student ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await studentDb.initiateForgotPassword(studentId.trim());
      if (res.success) {
        setMaskedPhone(res.maskedPhone || "+251 91 *** **78");
        setStep(2);
        setResendTimer(45);
        setCanResend(false);
      } else {
        setError(res.message || "Student ID not found.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to locate student ID.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await studentDb.verifyOtp(studentId.trim(), code);
      if (res.success) {
        setStep(3);
      } else {
        setError(res.message || "Invalid or expired verification code.");
      }
    } catch (err: any) {
      setError(err?.message || "Verification code rejected.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setError(null);
    setLoading(true);
    try {
      await studentDb.initiateForgotPassword(studentId.trim());
      setResendTimer(45);
      setCanResend(false);
    } catch (err: any) {
      setError(err?.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isPasswordValid) {
      setError("Please meet all password requirements and make sure passwords match.");
      return;
    }

    const code = otp.join("");
    setLoading(true);
    try {
      const res = await studentDb.resetPassword(studentId.trim(), code, newPassword);
      if (res.success) {
        setStep(4);
      } else {
        setError(res.message || "Failed to reset password.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center px-4 py-6 overflow-y-auto bg-[#2e1065]">
      {/* Background with overlay */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=2000&q=80')`,
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-purple-950/85 via-purple-900/90 to-[#1e1b4b]/95 backdrop-blur-[2px]" />

      {/* Header Logo */}
      <div className="relative z-10 text-center pt-6 space-y-1.5 animate-in fade-in duration-500">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl mb-1 ring-4 ring-white/10">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Bright Path
        </h1>
        <p className="text-xs text-purple-200">Student Portal Security</p>
      </div>

      {/* Main Card (Panels 1, 2, 3, 4 of Password Reset in UI reference) */}
      <div className="relative z-10 w-full max-w-md my-6 animate-in fade-in zoom-in-95 duration-400">
        <div className="bg-white rounded-3xl shadow-2xl p-7 md:p-8 border border-purple-100">
          {/* Progress dots indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === i
                    ? "w-8 bg-purple-700"
                    : step > i
                    ? "w-4 bg-purple-400"
                    : "w-4 bg-slate-200"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in shake">
              {error}
            </div>
          )}

          {/* ─── STEP 1: Enter Student ID ─────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-800">Reset Password</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your Student ID to receive a verification code
                </p>
              </div>

              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Student ID
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type="text"
                      placeholder="e.g. AH-2026-00125"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="pl-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 font-medium"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-700/25 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </form>

              <div className="text-center pt-2">
                <Link
                  href="/student/login"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Verify Phone OTP ─────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-800">Verify Phone (OTP)</h3>
                <p className="text-xs text-slate-500 mt-1">
                  We sent a 6-digit code to your phone number
                </p>
                <p className="text-xs font-semibold text-purple-700 mt-0.5">
                  {maskedPhone}
                </p>
              </div>

              <form onSubmit={handleStep2Submit} className="space-y-4">
                <div className="flex justify-between gap-2 max-w-xs mx-auto py-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all bg-slate-50/50 focus:bg-white text-slate-800"
                    />
                  ))}
                </div>

                <div className="text-center text-xs text-slate-500">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="text-purple-700 font-semibold hover:underline"
                    >
                      Resend Code
                    </button>
                  ) : (
                    <span>
                      Resend in <span className="font-semibold text-slate-700">00:{resendTimer.toString().padStart(2, "0")}</span>
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-700/25 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying Code...
                    </>
                  ) : (
                    "Next"
                  )}
                </Button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change Student ID
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Create New Password ───────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-800">Create New Password</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a secure password for your student portal
                </p>
              </div>

              {/* Password Requirements Checklist */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasMinLength ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    ✓
                  </span>
                  <span>8+ characters</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasUppercase ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    ✓
                  </span>
                  <span>1 uppercase letter</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasLowercase ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    ✓
                  </span>
                  <span>1 lowercase letter</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${hasNumber ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    ✓
                  </span>
                  <span>1 number</span>
                </div>
              </div>

              <form onSubmit={handleStep3Submit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid}
                  className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-700/25 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* ─── STEP 4: Success Screen ───────────────────────────────────── */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4 animate-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner ring-4 ring-emerald-50">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  Password Reset Successfully!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Your student password has been updated. You can now login with your new credentials.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => router.push("/student/login")}
                  className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-700/25"
                >
                  Go to Login
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 text-center text-[11px] text-purple-200/80 pb-4">
        © {new Date().getFullYear()} Bright Path. All rights reserved. • Powered by Ethio Nova
      </footer>
    </div>
  );
}
