"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

/**
 * Client-side redirect component for the root route.
 * Sends authenticated users to their dashboard and unauthenticated
 * users to /login. This is extracted into its own "use client" component
 * so that the parent page.tsx can be a Server Component and export `metadata`.
 */
export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null
    const userStr = typeof window !== "undefined" ? localStorage.getItem("attendance_current_user") : null

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        if (user.role === "parent") {
          router.replace("/parent/notifications")
          return
        }
      } catch (e) {}
    }
    router.replace("/login")
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
