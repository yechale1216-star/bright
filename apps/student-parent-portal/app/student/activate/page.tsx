"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  User,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studentDb } from "@/lib/db/student-db";

type Step = 1 | 2 | 3;

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

export default function StudentActivatePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [studentId, setStudentId] = useState("");
  const [activationCode, setActivationCode] = useState(["", "", "", "", "", "", "", ""]);
  const [studentName, setStudentName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const notSameAsId = newPassword !== studentId;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch && notSameAsId;

  const fullCode = activationCode.join("");

  // Step 1: Verify activation code
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!studentId.trim()) { setError("Please enter your Student ID."); return; }
    if (fullCode.length < 8) { setError("Please enter the complete 8-character activation code."); return; }

    setLoading(true);
    try {
      const res = await studentDb.verifyActivationCode(studentId.trim(), fullCode);
      if (res.success) {
        setStudentName(res.studentName || "");
        setStep(2);
      } else {
        setError(res.message || "Invalid activation code.");
      }
    } catch (err: any) {
      setError(err?.message || "Could not verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Activate with password
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isPasswordValid) { setError("Please make sure all password requirements are met."); return; }

    setLoading(true);
    try {
      const res = await studentDb.activateAccount(studentId.trim(), fullCode, newPassword);
      if (res.success) {
        setStep(3);
      } else {
        setError(res.message || "Activation failed. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Activation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Activation code input handler
  const handleCodeInput = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    const newCode = [...activationCode];
    newCode[index] = char;
    setActivationCode(newCode);
    if (char && index < 7) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !activationCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (pasted.length > 0) {
      const newCode = [...activationCode];
      for (let i = 0; i < 8; i++) { newCode[i] = pasted[i] || ""; }
      setActivationCode(newCode);
      const nextEmpty = Math.min(pasted.length, 7);
      codeRefs.current[nextEmpty]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center px-4 py-8 overflow-y-auto bg-[#2e1065]">
      {/* Atmospheric background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2000&q=80')` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-purple-950/85 via-purple-900/90 to-[#1e1b4b]/95 backdrop-blur-[2px]" />

      {/* Logo */}
      <div className="relative z-10 text-center pt-2 space-y-1 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl shadow-purple-900/50 mb-1 ring-2 ring-white/10">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Bright Path</h1>
        <p className="text-xs uppercase tracking-widest text-purple-200 font-semibold">Student Portal</p>
      </div>

      {/* Progress dots */}
      <div className="relative z-10 flex items-center gap-2 mt-4 mb-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? "bg-purple-300 w-8" : "bg-white/20 w-4"}`} />
        ))}
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md my-2 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-purple-100">

          {/* Step 1: Enter Student ID + activation code */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-5">
              <div className="text-center mb-1">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-purple-100 mb-3">
                  <KeyRound className="w-5 h-5 text-purple-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Activate Your Account</h3>
                <p className="text-xs text-slate-500 mt-1">Enter your Student ID and the activation code from your school-issued slip</p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Student ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Student ID</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="e.g. STU000042"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="pl-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-medium uppercase"
                    required
                  />
                </div>
              </div>

              {/* Activation code grid */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Activation Code</label>
                <p className="text-[10px] text-slate-400">From your school-issued activation slip</p>
                <div className="flex gap-1.5 justify-between" onPaste={handleCodePaste}>
                  {activationCode.map((char, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      type="text"
                      inputMode="text"
                      maxLength={1}
                      value={char}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="w-9 h-10 text-center text-sm font-bold uppercase tracking-widest border-2 rounded-lg focus:outline-none focus:border-purple-600 bg-slate-50 text-slate-800 transition-colors border-slate-200"
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-700/25 transition-all cursor-pointer flex items-center justify-center"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : <>Verify Code <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>

              <div className="text-center pt-1">
                <Link href="/student/login" className="text-xs text-purple-700 font-semibold hover:text-purple-900 transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: Set password */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="text-center mb-1">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-purple-100 mb-3">
                  <Lock className="w-5 h-5 text-purple-700" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Create Your Password</h3>
                {studentName && (
                  <p className="text-xs text-slate-500 mt-1">Welcome, <span className="font-semibold text-slate-700">{studentName}</span>! Set a secure password to access your account.</p>
                )}
                {!studentName && <p className="text-xs text-slate-500 mt-1">Set a strong password for your account</p>}
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-medium"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Confirm Password</label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Requirements checklist */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Password Requirements</p>
                <PasswordCheck passed={hasMinLength} label="At least 8 characters" />
                <PasswordCheck passed={hasUppercase} label="One uppercase letter (A–Z)" />
                <PasswordCheck passed={hasLowercase} label="One lowercase letter (a–z)" />
                <PasswordCheck passed={hasNumber} label="One number (0–9)" />
                <PasswordCheck passed={passwordsMatch} label="Passwords match" />
                <PasswordCheck passed={notSameAsId} label="Not the same as your Student ID" />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => { setStep(1); setError(null); }}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-slate-200 text-slate-600 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid}
                  className="flex-1 h-11 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-700/25 transition-all cursor-pointer flex items-center justify-center"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating...</> : <>Activate <Sparkles className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-5 py-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 mx-auto">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Account Activated!</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Welcome to <span className="font-semibold text-purple-700">Bright Path</span>! Your account is ready. You're now signed in.
                </p>
              </div>
              <Button
                onClick={() => router.push("/student")}
                className="w-full h-11 bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-700/25 transition-all cursor-pointer flex items-center justify-center"
              >
                Go to My Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Login link */}
      {step === 1 && (
        <div className="relative z-10 mt-4 text-center">
          <p className="text-xs text-purple-200/80">
            Already activated?{" "}
            <Link href="/student/login" className="text-white font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      )}

      <footer className="relative z-10 text-center text-[11px] text-purple-200/80 pt-3 pb-3">
        © {new Date().getFullYear()} Bright Path. All rights reserved. • Powered by Ethio Nova
      </footer>
    </div>
  );
}
