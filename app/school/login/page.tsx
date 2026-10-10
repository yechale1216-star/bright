"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, ArrowRight, Shield, User, Phone, Mail, Loader2 } from "lucide-react";
import { authService } from "@/lib/auth/auth";
import { authStorage } from "@/lib/auth/auth-storage";
import { useAuth } from "@/lib/context/auth-context";
import { notifications } from "@/lib/utils/notifications";
import { clearMessageCache } from "@/lib/utils/message-cache";

// Roles allowed in the School Portal
const SCHOOL_STAFF_ROLES = [
  "admin",
  "school_admin",
  "super_admin",
  "teacher",
  "registrar",
  "discipline_officer",
  "staff",
];

function SchoolLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { validateSession } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("reason") === "expired") return;
    const token = authStorage.getToken();
    const user = authStorage.getUser();
    if (token && user) {
      const role = (user.role || "").toLowerCase();
      if (SCHOOL_STAFF_ROLES.includes(role)) {
        if (role === "admin" || role === "school_admin" || role === "super_admin") router.replace("/school/admin");
        else if (role === "teacher") router.replace("/school/teacher");
        else if (role === "registrar") router.replace("/school/registrar");
        else if (role === "discipline_officer") router.replace("/school/discipline-officer");
        else router.replace("/school/staff");
      }
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const cleanId = identifier.trim();

    if (!cleanId) {
      setLoginError("Please enter your email or phone number.");
      return;
    }
    if (!password) {
      setLoginError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      await clearMessageCache().catch(() => {});
      const result = await authService.login({ email: cleanId, password });

      if (result.success && result.user) {
        const role = (result.user.role || "").toLowerCase();
        // SECURITY: Block non-staff from School Portal
        if (!SCHOOL_STAFF_ROLES.includes(role)) {
          setLoginError(
            "Access denied. This portal is for school staff only. Please use the Student & Parent Portal instead."
          );
          authStorage.clearSession().catch(() => {});
          return;
        }
        notifications.success("Welcome Back!", `${result.user.name}, you are signed in.`);
        localStorage.setItem("_zt_fresh_login", "1");
        localStorage.setItem("_zt_login_role", role);
        await validateSession();
        if (role === "admin" || role === "school_admin" || role === "super_admin") router.push("/school/admin");
        else if (role === "academic_head") router.push("/school/academic-head");
        else if (role === "teacher") router.push("/school/teacher");
        else if (role === "librarian") router.push("/school/library");
        else if (role === "transport_manager") router.push("/school/transport");
        else if (role === "staff_attendance_officer" || role === "hr_officer") router.push("/school/staff-hr");
        else if (role === "registrar") router.push("/school/registrar");
        else if (role === "discipline_officer") router.push("/school/discipline-officer");
        else router.push("/school/staff");
      } else {
        setLoginError(result.error || result.message || "Invalid credentials.");
      }
    } catch {
      setLoginError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden select-none bg-slate-900">
      {/* Background School Campus Photo */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/school-bg.jpg')" }}
      />

      {/* Subtle radial overlay for clean contrast */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-sky-900/10 via-transparent to-slate-950/40 pointer-events-none" />

      {/* Main Centered Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-24 sm:pb-28">
        {/* Top Logo & Brand */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 text-center animate-in fade-in duration-700">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-2xl mb-3 border-2 border-white/20 bg-white/10 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bright-path-logo.png"
              alt="Bright Path Logo"
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#152e4d] tracking-wider uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
            BRIGHT PATH
          </h1>
        </div>

        {/* White Login Card */}
        <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-[#152e4d] tracking-tight">
              Welcome Back
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Sign in to your school account
            </p>
          </div>

          {searchParams.get("reason") === "expired" && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              Your session has expired. Please sign in again.
            </div>
          )}

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone or Email Input */}
            <div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="school-identifier"
                  type="text"
                  placeholder="Phone number or Email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full h-12 pl-10 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="school-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-12 pl-10 pr-11 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="font-medium text-xs sm:text-sm">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-2 flex items-center justify-center gap-2 bg-[#1259c3] hover:bg-[#0e49a1] text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-blue-700/25 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          {/* Secure · Trusted · Bright Path Divider */}
          <div className="flex items-center gap-3 mt-6 pt-2">
            <div className="h-[1px] bg-slate-200 flex-1" />
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium whitespace-nowrap">
              Secure &nbsp;·&nbsp; Trusted &nbsp;·&nbsp; Bright Path
            </span>
            <div className="h-[1px] bg-slate-200 flex-1" />
          </div>
        </div>
      </main>

      {/* Dark Footer Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 py-3 bg-[#0d1b31]/95 backdrop-blur-md border-t border-white/10 text-white">
        {/* Left: Shield & School Portal */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Shield className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold tracking-tight text-white leading-tight">
              Bright Path School Portal
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 leading-tight">
              Empowering schools for a brighter future
            </div>
          </div>
        </div>

        {/* Right: Developed by Ethio Nova */}
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
  );
}

export default function SchoolLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      }
    >
      <SchoolLoginContent />
    </Suspense>
  );
}
