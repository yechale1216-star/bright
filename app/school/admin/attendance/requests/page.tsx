"use client"

import React, { Suspense } from "react"
import { useRouter } from "next/navigation"
import { AttendanceEditRequestsScreen } from "@/components/school/attendance-edit-requests-screen"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function AttendanceRequestsPage() {
  const router = useRouter()

  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <div className="p-4 md:p-8">
        <AttendanceEditRequestsScreen onBack={() => router.push("/school/admin")} />
      </div>
    </Suspense>
  )
}
