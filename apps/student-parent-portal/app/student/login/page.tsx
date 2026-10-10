"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, User, Lock, Eye, EyeOff, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { studentDb } from "@/lib/db/student-db";

export default function StudentLoginPage() {
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!studentId.trim() || !password.trim()) {
      setError("Please enter both your Student ID and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await studentDb.login(studentId.trim(), password.trim());
      if (res.success) {
        router.push("/student");
      } else {
        setError(res.message || "Invalid Student ID or password.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center px-4 py-6 overflow-y-auto bg-[#2e1065]">
      {/* Background with scenic overlay and subtle atmospheric glows */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=2000&q=80')`,
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-purple-950/85 via-purple-900/90 to-[#1e1b4b]/95 backdrop-blur-[2px]" />

      {/* Header Logo & Title */}
      <div className="relative z-10 text-center pt-2 space-y-1 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl shadow-purple-900/50 mb-1 ring-2 ring-white/10">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Bright Path
        </h1>
        <p className="text-xs uppercase tracking-widest text-purple-200 font-semibold">
          Student Portal
        </p>
      </div>

      {/* Login Card (Screen 1 in UI reference) */}
      <div className="relative z-10 w-full max-w-md my-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-purple-100">
          <div className="text-center mb-5">
            <h3 className="text-xl font-bold text-slate-800">Welcome Back</h3>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to your student account
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium animate-in shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Student ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Student ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="e.g. STU000002"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="pl-10 h-11 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 text-slate-800 font-medium"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Sign In Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-700/25 transition-all mt-3 cursor-pointer flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Forgot password */}
          <div className="text-center mt-4">
            <Link
              href="/student/forgot-password"
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>

      {/* Footer (Matching UI reference) */}
      <footer className="relative z-10 text-center text-[11px] text-purple-200/80 pt-2 pb-3">
        © {new Date().getFullYear()} Bright Path. All rights reserved. • Powered by Ethio Nova
      </footer>
    </div>
  );
}
