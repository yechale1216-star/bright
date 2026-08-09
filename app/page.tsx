"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Page() {
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
    <div className="min-h-screen bg-[#070d1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#1a3a6b]/30 border-t-[#1a3a6b] rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400">Loading Addis Hiwot...</p>
      </div>
    </div>
  )
}
