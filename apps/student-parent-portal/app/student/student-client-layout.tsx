"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { AuthGuard } from "@/components/auth/auth-guard";

export function StudentClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname.startsWith("/student/login") ||
    pathname.startsWith("/student/forgot-password");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <AuthGuard allowedRoles={["student"]}>
      <StudentShell>{children}</StudentShell>
    </AuthGuard>
  );
}
