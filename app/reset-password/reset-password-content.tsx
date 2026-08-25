"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Logo } from "@/components/logo"
import { DeveloperBrand } from "@/components/developer-brand"

export default function ResetPasswordPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? undefined

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        {!token && (
          <div className="flex justify-center mb-8">
            <Logo size="md" href="/" />
          </div>
        )}
        <ResetPasswordForm
          token={token}
          onResetSuccess={() => router.push("/login")}
        />
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
