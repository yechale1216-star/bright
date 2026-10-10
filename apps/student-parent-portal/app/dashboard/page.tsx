"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { authStorage } from "@/lib/auth/auth-storage";
import { isStudentOrParentRole } from "@/packages/auth";

export default function StudentParentDashboardDispatcher() {
  const router = useRouter();

  useEffect(() => {
    const route = async () => {
      await authStorage.restoreSession().catch(() => {});
      const user = authStorage.getUser();
      const role = (user?.role || "").toLowerCase();

      if (!isStudentOrParentRole(role)) {
        router.replace("/login");
        return;
      }

      if (role === "parent") {
        router.replace("/parent/dashboard");
      } else {
        router.replace("/student");
      }
    };

    route();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070d1a] flex items-center justify-center">
      <Spinner size="lg" className="text-purple-500" />
    </div>
  );
}
