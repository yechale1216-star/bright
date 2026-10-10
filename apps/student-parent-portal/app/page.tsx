"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { authStorage } from "@/lib/auth/auth-storage";
import { isStudentOrParentRole } from "@/packages/auth";

/**
 * Student & Parent Portal Root Route
 * Immediately checks for an active student or parent session:
 * - If authenticated as Parent: routes directly to /parent/dashboard
 * - If authenticated as Student: routes directly to /student
 * - If not authenticated or non-student/parent: routes directly to /login
 *
 * NO account-type selection page.
 */
export default function StudentParentHomePage() {
  const router = useRouter();

  useEffect(() => {
    let isCancelled = false;

    const routeUser = async () => {
      await authStorage.restoreSession().catch(() => {});
      if (isCancelled) return;

      const token = authStorage.getToken();
      const user = authStorage.getUser();

      if (token && user) {
        const role = (user.role || "").toLowerCase();

        // If staff attempts access here, reject from this portal
        if (!isStudentOrParentRole(role)) {
          console.warn(`[StudentParentPortal] Staff role '${role}' attempted access. Redirecting to /login`);
          await authStorage.clearSession().catch(() => {});
          router.replace("/login");
          return;
        }

        if (role === "parent") {
          router.replace("/parent/dashboard");
          return;
        }

        if (role === "student") {
          router.replace("/student");
          return;
        }
      }

      // Check student-specific local storage
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

      // Not authenticated -> Direct straight to Student & Parent Login
      router.replace("/login");
    };

    routeUser();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col items-center justify-center gap-3">
      <Spinner size="lg" className="text-purple-500" />
      <p className="text-xs text-slate-400 font-medium">Entering Bright Path Student &amp; Parent Portal...</p>
    </div>
  );
}
