"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  User,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studentDb } from "@/lib/db/student-db";

function PasswordCheck({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs transition-colors ${passed ? "text-emerald-600" : "text-slate-400"}`}>
      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${passed ? "bg-emerald-500" : "bg-slate-200"}`}>
        {passed && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </div>
      {label}
    </div>
  );
}

function StudentActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [studentId, setStudentId] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActivated, setIsActivated] = useState(false);
  const [studentName, setStudentName] = useState<string | null>(null);

  // Auto-populate Student ID from query params (e.g. redirected from login)
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) {
      setStudentId(idParam.trim().toUpperCase());
    }
  }, [searchParams]);

  // Password requirements
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const notSameAsId = !studentId.trim() || newPassword.trim().toLowerCase() !== studentId.trim().toLowerCase();
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch && notSameAsId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedId = studentId.trim().toUpperCase();
    const cleanCode = activationCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (!trimmedId) {
      setError("Please enter your Student ID.");
      return;
    }
    if (!cleanCode || cleanCode.length < 8) {
      setError("Please enter your complete 8-character activation code.");
      return;
    }
    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      setError("Password must be at least 8 characters long and contain uppercase letters, lowercase letters, and numbers.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!notSameAsId) {
      setError("Password cannot be the same as your Student ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await studentDb.activateAccount(trimmedId, cleanCode, newPassword, confirmPassword);
      if (res.success) {
        setStudentName(res.student?.fullName || null);
        setIsActivated(true);
      } else {
        setError(res.message || "Invalid Student ID or activation code. Check your school-issued slip.");
      }
    } catch (err: any) {
      setError(err?.message || "Activation failed. Please verify your Student ID and activation code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center px-4 py-8 overflow-y-auto bg-[#2e1065]">
      {/* Background with scenic overlay and subtle atmospheric glows */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2000&q=80')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-purple-950/85 via-purple-900/90 to-[#1e1b4b]/95 backdrop-blur-[2px]" />

      {/* Header Logo */}
      <div className="relative z-10 text-center pt-2 space-y-1 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl shadow-purple-900/50 mb-1 ring-2 ring-white/10">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Bright Path</h1>
        <p className="text-xs uppercase tracking-widest text-purple-200 font-semibold">Student Portal</p>
      </div>

      {/* Main Activation Card */}
      <div className="relative z-10 w-full max-w-md my-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-purple-100">

          {!isActivated ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-purple-100 mb-2">
                  <KeyRound className="w-5 h-5 text-purple-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Activate Your Account</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your Student ID and activation code to choose your permanent password.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in shake">
                  {error}
                </div>
              )}

              {/* 1. Student ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Student ID</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="e.g. STU000042"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                    className="pl-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-mono font-bold uppercase"
                    required
                  />
                </div>
              </div>

              {/* 2. Activation Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 block">Activation Code</label>
                  <span className="text-[10px] text-purple-600 font-medium">From school-issued slip</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="8-character code (e.g. ABC23456)"
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                    maxLength={8}
                    className="pl-10 h-11 text-sm rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-900 font-mono font-bold tracking-[0.2em] uppercase"
                    required
                  />
                </div>
              </div>

              {/* 3. New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 4. Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Confirm Password</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Password Requirements</p>
                <PasswordCheck passed={hasMinLength} label="At least 8 characters" />
                <PasswordCheck passed={hasUppercase} label="One uppercase letter (A–Z)" />
                <PasswordCheck passed={hasLowercase} label="One lowercase letter (a–z)" />
                <PasswordCheck passed={hasNumber} label="One number (0–9)" />
                <PasswordCheck passed={passwordsMatch} label="Passwords match" />
                <PasswordCheck passed={notSameAsId} label="Not the same as your Student ID" />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !isPasswordValid || activationCode.length < 8 || !studentId.trim()}
                className="w-full h-11 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-700/25 transition-all mt-2 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating Account...
                  </>
                ) : (
                  <>
                    Activate Account
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <Link href="/student/login" className="text-xs text-purple-700 font-semibold hover:text-purple-900 transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          ) : (
            /* Success Screen */
            <div className="text-center space-y-5 py-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 mx-auto ring-8 ring-emerald-50">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Account Activated!</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {studentName ? (
                    <>Welcome, <span className="font-semibold text-slate-700">{studentName}</span>! </>
                  ) : null}
                  Your account is activated and your permanent password has been set. You are now signed in.
                </p>
              </div>
              <Button
                onClick={() => router.push("/student")}
                className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-700/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Go to My Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      {!isActivated && (
        <div className="relative z-10 mt-2 text-center">
          <p className="text-xs text-purple-200/80">
            Already activated your account?{" "}
            <Link href="/student/login" className="text-white font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      )}

      <footer className="relative z-10 text-center text-[11px] text-purple-200/80 pt-4 pb-3">
        © {new Date().getFullYear()} Bright Path. All rights reserved. • Powered by Ethio Nova
      </footer>
    </div>
  );
}

export default function StudentActivatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#2e1065] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-purple-300" />
      </div>
    }>
      <StudentActivateForm />
    </Suspense>
  );
}
