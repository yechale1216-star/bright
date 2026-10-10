"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { authStorage } from "@/lib/auth/auth-storage"
import { isSchoolStaffRole } from "@/packages/auth"

/**
 * School Portal Root Route
 * Immediately checks for an active school staff session:
 * - If authenticated as authorized school staff: routes directly to designated dashboard
 * - If not authenticated or non-staff: routes directly to /login
 *
 * NO account-type selection page.
 */
export default function SchoolPortalHomePage() {
  const router = useRouter()

  useEffect(() => {
    let isCancelled = false

    const routeStaff = async () => {
      await authStorage.restoreSession().catch(() => {})
      if (isCancelled) return

      const token = authStorage.getToken()
      const user = authStorage.getUser()

      if (token && user) {
        const role = user.role?.toLowerCase() || ""

        // If a non-staff user opens the school portal, clear session and send to login
        if (!isSchoolStaffRole(role)) {
          console.warn(`[SchoolPortal] Non-staff role '${role}' attempted access. Redirecting to /login`)
          await authStorage.clearSession().catch(() => {})
          router.replace("/login")
          return
        }

        if (role === "admin" || role === "school_admin" || role === "super_admin") {
          router.replace("/school/admin")
          return
        }
        if (role === "teacher") {
          router.replace("/school/teacher")
          return
        }
        if (role === "registrar") {
          router.replace("/school/registrar")
          return
        }
        if (role === "discipline_officer") {
          router.replace("/school/discipline-officer")
          return
        }
        if (role === "staff") {
          router.replace("/school/staff")
          return
        }

        router.replace("/school/staff")
        return
      }

      // Not authenticated -> Direct straight to School Login
      router.replace("/login")
    }

    routeStaff()

    return () => {
      isCancelled = true
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col items-center justify-center gap-3">
      <Spinner size="lg" className="text-blue-500" />
      <p className="text-xs text-slate-400 font-medium">Entering Bright Path School Portal...</p>
    </div>
  )
}
