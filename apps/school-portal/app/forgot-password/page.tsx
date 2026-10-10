"use client";

import { useRouter } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { DeveloperBrand } from "@/components/developer-brand";

export default function SchoolForgotPasswordPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ForgotPasswordForm onBackToLogin={() => router.push("/login")} />
        <div className="mt-8 text-center flex flex-col items-center gap-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
            &copy; {new Date().getFullYear()} Bright Path &bull; School Portal
          </p>
          <DeveloperBrand type="developed" />
        </div>
      </div>
    </div>
  );
}
