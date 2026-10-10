"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { authStorage } from "@/lib/auth/auth-storage";
import { isSchoolStaffRole } from "@/packages/auth";

export default function SchoolDashboardDispatcher() {
  const router = useRouter();

  useEffect(() => {
    const route = async () => {
      await authStorage.restoreSession().catch(() => {});
      const user = authStorage.getUser();
      const role = (user?.role || "").toLowerCase();

      if (!isSchoolStaffRole(role)) {
        router.replace("/login");
        return;
      }

      if (role === "admin" || role === "school_admin" || role === "super_admin") {
        router.replace("/school/admin");
      } else if (role === "teacher") {
        router.replace("/school/teacher");
      } else if (role === "registrar") {
        router.replace("/school/registrar");
      } else if (role === "discipline_officer") {
        router.replace("/school/discipline-officer");
      } else {
        router.replace("/school/staff");
      }
    };

    route();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#070d1a] flex items-center justify-center">
      <Spinner size="lg" className="text-blue-500" />
    </div>
  );
}
