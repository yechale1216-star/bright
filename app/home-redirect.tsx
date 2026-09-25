"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { authStorage } from "@/lib/auth/auth-storage"

/**
 * Client-side redirect component for the root route.
 * Restores session from persistent storage (including Android Native Preferences)
 * and seamlessly routes authenticated users to their designated role dashboard,
 * ensuring closing/swiping the app away never kicks users to the login screen.
 */
export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    let isCancelled = false

    const routeUser = async () => {
      // 1. Ensure session is restored from native preferences if needed
      await authStorage.restoreSession().catch(() => {})

      if (isCancelled) return

      const token = authStorage.getToken()
      const user = authStorage.getUser()

      if (token && user) {
        const role = user.role?.toLowerCase() || ""
        console.log(`[HomeRedirect] Active session found for user '${user.id}' with role '${role}'`)

        if (role === "parent") {
          router.replace("/parent/dashboard")
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

        // Default staff fallback for any other school employee role
        router.replace("/school/staff")
        return
      }

      // No authenticated session in storage
      console.log("[HomeRedirect] No authenticated session found. Directing to /login.")
      router.replace("/login")
    }

    routeUser()

    return () => {
      isCancelled = true
    }
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
