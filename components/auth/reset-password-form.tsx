"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Logo } from "@/components/logo"
import { Eye, EyeOff, CheckCircle2, Lock, Loader2, XCircle } from "lucide-react"

interface ResetPasswordFormProps {
  token: string
  onResetSuccess: () => void
}

export function ResetPasswordForm({ token, onResetSuccess }: ResetPasswordFormProps) {
  const [passwords, setPasswords] = useState({
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const result = await authService.verifyResetToken(token)
        setTokenValid(result.valid)
        if (!result.valid) {
          notifications.error("Invalid Token", "This reset link is invalid or has expired.")
        }
      } catch (error) {
        setTokenValid(false)
        notifications.error("Error", "Unable to verify reset token.")
      }
    }

    if (token) {
      verifyToken()
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!passwords.password || !passwords.confirmPassword) {
      notifications.error("Validation Error", "Please fill in all fields")
      return
    }

    if (passwords.password !== passwords.confirmPassword) {
      notifications.error("Validation Error", "Passwords do not match")
      return
    }

    if (passwords.password.length < 6) {
      notifications.error("Validation Error", "Password must be at least 6 characters")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.resetPassword(token, passwords.password)

      if (result.success) {
        notifications.success("Password Reset", "Your password has been successfully reset!")
        onResetSuccess()
      } else {
        notifications.error("Reset Failed", result.error || "Failed to reset password")
      }
    } catch (error) {
      notifications.error("Error", "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  if (tokenValid === null) {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-pulse relative z-10">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin" />
          <p className="typography-label text-slate-600 dark:text-slate-400">Verifying reset token...</p>
        </CardContent>
      </Card>
    )
  }

  if (tokenValid === false) {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border relative z-10">
        <CardHeader className="text-center pt-9 pb-4 px-8">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-3xl font-black text-red-600 dark:text-red-400 tracking-tight leading-none pt-2">Invalid Reset Link</CardTitle>
          <CardDescription className="typography-label text-slate-600 dark:text-slate-400">This link is invalid or has expired</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 text-center space-y-6">
          <p className="typography-body text-slate-800 dark:text-slate-300">
            Password reset links expire after 1 hour for security reasons. Please request a new link if needed.
          </p>
          <Button onClick={() => (window.location.href = "/login")} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all font-bold">
            Request New Reset Link
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
      <CardHeader className="space-y-4 pb-6 pt-9 px-8 text-center relative flex flex-col items-center">
        <Logo size="xl" withText={true} href="/" className="mb-2" />
        <CardTitle className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">Set New Password</CardTitle>
        <CardDescription className="typography-label text-slate-600 dark:text-slate-400">
          Create a secure new password for your account
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-800 dark:text-slate-300">New Password</Label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={passwords.password}
                onChange={(e) => setPasswords((prev) => ({ ...prev, password: e.target.value }))}
                required
                minLength={6}
                className="pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-slate-800 dark:text-slate-300">Confirm New Password</Label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                required
                minLength={6}
                className="pl-10 pr-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {passwords.password && passwords.confirmPassword && (
            <div className="animate-in fade-in duration-300">
              {passwords.password === passwords.confirmPassword ? (
                <div className="typography-helper flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Passwords match
                </div>
              ) : (
                <div className="typography-helper flex items-center text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Passwords do not match
                </div>
              )}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]" 
            disabled={isLoading || passwords.password !== passwords.confirmPassword}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}



