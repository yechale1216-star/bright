"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Logo } from "@/components/logo"
import { DeveloperBrand } from "@/components/developer-brand"

export default function ResetPasswordPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-3xl shadow-2xl border border-border/40 p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <Logo size="md" href="/" />
          </div>
          <h1 className="text-2xl font-bold text-destructive mb-4">Invalid Reset Link</h1>
          <p className="text-muted-foreground mb-6">No reset token provided. Please request a new password reset.</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-xl font-semibold hover:opacity-90 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8">
          <Logo size="md" href="/" />
        </div>
        <ResetPasswordForm token={token} onResetSuccess={() => router.push("/login")} />
        <div className="mt-8 text-center flex flex-col items-center gap-2.5">
          <div className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-[0.2em]">
            &copy; {new Date().getFullYear()} Addis Hiwot &bull; Management Suite
          </div>
          <DeveloperBrand type="developed" />
        </div>
      </div>
    </div>
  )
}
