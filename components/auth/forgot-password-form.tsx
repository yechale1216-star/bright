"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService } from "@/lib/auth/auth"
import { notifications } from "@/lib/utils/notifications"
import { Logo } from "@/components/logo"
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react"

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      notifications.error("Validation Error", "Please enter your email address")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notifications.error("Validation Error", "Please enter a valid email address")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.requestPasswordReset(email)

      if (result.success) {
        setEmailSent(true)
        notifications.success(
          "Reset Email Sent",
          "Password reset instructions have been sent."
        )
      } else {
        setEmailSent(true)
        notifications.success(
          "Reset Email Sent",
          "If an account exists, you'll receive instructions shortly."
        )
      }
    } catch (error) {
      notifications.error("Error", "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in zoom-in-95 duration-500 relative z-10">
        <CardHeader className="text-center pt-9 pb-4 px-8">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">Check Your Email</CardTitle>
          <CardDescription className="typography-label text-slate-600 dark:text-slate-400">We&apos;ve sent reset instructions to your inbox</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 text-center space-y-6">
          <p className="typography-body text-slate-800 dark:text-slate-300">
            Instructions have been sent to <strong className="text-slate-900 dark:text-white">{email}</strong>. 
            Please follow the link in the email to securely reset your password.
          </p>
          <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
             <p className="text-[11px] text-slate-500 dark:text-slate-500 italic font-medium leading-relaxed">
               Didn&apos;t receive the email? Check your spam folder or try again in a few minutes.
             </p>
          </div>
          <Button variant="outline" onClick={onBackToLogin} className="w-full h-12 rounded-xl bg-slate-100 dark:bg-transparent border-slate-300 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/5 hover:border-slate-400 dark:hover:border-white/20 transition-all font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl rounded-3xl overflow-hidden border animate-in fade-in duration-500 relative z-10">
      <CardHeader className="space-y-4 pb-6 pt-9 px-8 text-center relative flex flex-col items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBackToLogin}
          className="absolute left-4 top-4 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Logo size="xl" withText={true} href="/" className="mb-2" />
        <CardTitle className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none pt-2">Reset Password</CardTitle>
        <CardDescription className="typography-label text-slate-600 dark:text-slate-400">
          Enter your email and we&apos;ll send recovery instructions
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-800 dark:text-slate-300">Email Address</Label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 group-focus-within:text-blue-700 dark:group-focus-within:text-blue-400 transition-colors">
                <Mail className="w-4 h-4" />
              </div>
              <Input
                id="email"
                type="email"
                placeholder="name@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-slate-100/50 dark:bg-white/5 border-slate-300 dark:border-white/10 h-12 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all rounded-xl"
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Instructions"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-300 dark:border-white/5 text-center">
          <Button variant="link" onClick={onBackToLogin} className="text-blue-700 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 p-0 h-auto font-bold">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}



