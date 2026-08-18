"use client"

import { Suspense } from "react"
import { MessagingCenter } from "@/components/messaging/messaging-center"

export default function StaffCommunicationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Loading messaging & announcements...
        </div>
      }
    >
      <div className="container mx-auto py-2 h-[calc(100vh-8rem)]">
        <MessagingCenter />
      </div>
    </Suspense>
  )
}
