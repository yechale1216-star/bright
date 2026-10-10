"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Spinner } from "@/components/ui/spinner";
import { DeveloperBrand } from "@/components/developer-brand";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || searchParams.get("reset-token") || "";

  return (
    <div className="w-full max-w-md">
      <ResetPasswordForm token={token} onResetSuccess={() => router.push("/login")} />
      <div className="mt-8 text-center flex flex-col items-center gap-2">
        <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
          &copy; {new Date().getFullYear()} Bright Path &bull; Student &amp; Parent Portal
        </p>
        <DeveloperBrand type="developed" />
      </div>
    </div>
  );
}

export default function StudentParentResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col items-center justify-center p-4">
      <Suspense fallback={<Spinner size="lg" className="text-purple-500" />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
