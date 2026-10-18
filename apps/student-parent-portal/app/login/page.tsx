"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Phone, Lock, Eye, EyeOff, ArrowRight, User, Loader2, GraduationCap, Users, Sparkles } from "lucide-react";
import { authService } from "@/lib/auth/auth";
import { authStorage } from "@/lib/auth/auth-storage";
import { useAuth } from "@/lib/context/auth-context";
import { notifications } from "@/lib/utils/notifications";
import { clearMessageCache } from "@/lib/utils/message-cache";
import { studentDb } from "@/lib/db/student-db";
import { Logo } from "@/components/logo";
import { DeveloperBrand } from "@/components/developer-brand";
import { PhoneInput } from "@/components/ui/phone-input";
import { isStudentOrParentRole } from "@/packages/auth";

type PortalTab = "student" | "parent";

function PortalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { validateSession } = useAuth();

  const [activeTab, setActiveTab] = useState<PortalTab>("student");

  // Student state
  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Parent state
  const [parentPhone, setParentPhone] = useState("+251");
  const [parentPassword, setParentPassword] = useState("");
  const [showParentPassword, setShowParentPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Redirect already-authenticated students/parents
  useEffect(() => {
    if (searchParams.get("reason") === "expired") return;
    const token = authStorage.getToken();
    const user = authStorage.getUser();
    if (token && user) {
      const role = (user.role || "").toLowerCase();
      if (role === "parent") {
        router.replace("/parent/dashboard");
        return;
      }
      if (role === "student") {
        router.replace("/student");
        return;
      }
    }
    // Check student-specific localStorage token
    if (typeof window !== "undefined") {
      const studentUser = localStorage.getItem("attendance_current_user");
      if (studentUser) {
        try {
          const u = JSON.parse(studentUser);
          if (u?.role === "student") {
            router.replace("/student");
            return;
          }
        } catch {
          // ignore
        }
      }
    }
  }, [router, searchParams]);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!studentId.trim()) {
      setLoginError("Please enter your Student ID.");
      return;
    }
    if (!studentPassword) {
      setLoginError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await studentDb.login(studentId.trim(), studentPassword.trim());
      if (res.success) {
        notifications.success("Welcome back!", "You are signed in to your student portal.");
        router.push("/student");
      } else {
        setLoginError(res.message || "Invalid Student ID or password.");
      }
    } catch (err: any) {
      setLoginError(err?.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const cleanPhone = parentPhone.replace(/\s+/g, "");
    if (!parentPhone || parentPhone === "+251") {
      setLoginError("Please enter your registered phone number.");
      return;
    }
    if (!/^\+251\d{9}$/.test(cleanPhone)) {
      setLoginError("Phone must be in format: +251XXXXXXXXX (9 digits).");
      return;
    }
    if (!parentPassword) {
      setLoginError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      await clearMessageCache().catch(() => {});
      const result = await authService.loginParent(cleanPhone, parentPassword);
      if (result.success) {
        localStorage.setItem("_zt_fresh_login", "1");
        localStorage.setItem("_zt_login_role", "parent");
        await validateSession();
        notifications.success("Welcome back!", "You are signed in to your Parent Portal.");
        router.push("/parent/dashboard");
      } else {
        setLoginError(result.message || "Invalid phone number or password.");
      }
    } catch (err: any) {
      setLoginError(err?.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070d1a]">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-pink-600/5 blur-[100px]" />
      </div>


      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700">


          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
            <div className="px-8 pt-8 pb-6 text-center border-b border-white/5">
              <Logo size="xl" withText={true} href="/" className="mb-4 justify-center" />
              <h1 className="text-2xl font-black text-white tracking-tight">Student &amp; Parent Portal</h1>

              {/* Segmented Tab Switcher */}
              <div className="mt-6 flex p-1 bg-white/5 rounded-2xl border border-white/10 gap-1">
                <button
                  type="button"
                  id="portal-tab-student"
                  onClick={() => { setActiveTab("student"); setLoginError(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === "student"
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  Student
                </button>
                <button
                  type="button"
                  id="portal-tab-parent"
                  onClick={() => { setActiveTab("parent"); setLoginError(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === "parent"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Parent
                </button>
              </div>
            </div>

            <div className="px-8 py-8 space-y-5">
              {searchParams.get("reason") === "expired" && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium animate-in slide-in-from-top-2 duration-300">
                  Your session has expired. Please sign in again.
                </div>
              )}
              {loginError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium animate-in slide-in-from-top-2 duration-300">
                  {loginError}
                </div>
              )}

              {/* STUDENT LOGIN FORM */}
              {activeTab === "student" && (
                <form onSubmit={handleStudentLogin} id="student-login-form" className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="student-id" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Student ID</label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors"><User className="w-4 h-4" /></div>
                      <input id="student-id" type="text" autoComplete="username" placeholder="e.g. STU000001" value={studentId} onChange={(e) => setStudentId(e.target.value)} required className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all font-mono" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="student-password" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                      <Link href="/student/forgot-password" className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors">Forgot password?</Link>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors"><Lock className="w-4 h-4" /></div>
                      <input id="student-password" type={showStudentPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} required className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all" />
                      <button type="button" onClick={() => setShowStudentPassword(!showStudentPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                        {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 h-12 mt-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-900/30 transition-all active:scale-[0.98]">
                    {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Signing In...</>) : (<>Sign In as Student<ArrowRight className="w-4 h-4" /></>)}
                  </button>

                  {/* Activation Section */}
                  <div className="pt-4 border-t border-white/10 text-center space-y-2.5">
                    <p className="text-xs text-slate-400 font-medium">
                      First time accessing your account?
                    </p>
                    <Link
                      href="/student/activate"
                      id="student-activate-account-link"
                      className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-white/15 bg-white/[0.02] hover:bg-white/[0.06] hover:border-purple-400/40 text-slate-200 hover:text-white text-sm font-semibold transition-all active:scale-[0.98]"
                    >
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Activate Account
                    </Link>
                  </div>
                </form>
              )}

              {/* PARENT LOGIN FORM */}
              {activeTab === "parent" && (
                <form onSubmit={handleParentLogin} id="parent-login-form" className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="parent-phone" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Registered Phone Number</label>
                    <PhoneInput id="parent-phone" value={parentPhone} onChange={(val) => setParentPhone(val)} placeholder="+251 9XX XXX XXX" required className="bg-white/5 border-white/10 text-white" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="parent-password" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                      <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">Forgot password?</Link>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors"><Lock className="w-4 h-4" /></div>
                      <input id="parent-password" type={showParentPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} required className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all" />
                      <button type="button" onClick={() => setShowParentPassword(!showParentPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                        {showParentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 h-12 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98]">
                    {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Signing In...</>) : (<>Sign In as Parent<ArrowRight className="w-4 h-4" /></>)}
                  </button>
                </form>
              )}

            </div>
          </div>

          <div className="mt-8 text-center space-y-2">
            <p className="text-[11px] text-slate-600 uppercase tracking-widest font-bold">
              &copy; {new Date().getFullYear()} Bright Path &bull; Student &amp; Parent Portal
            </p>
            <DeveloperBrand type="developed" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070d1a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>}>
      <PortalLoginContent />
    </Suspense>
  );
}
