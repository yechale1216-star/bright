import React from "react"
import TransportClientLayout from "@/components/school/transport-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Transport Console",
  description: "School Transport Fleet, Transit Routes, Bus Stops, and Student Rider Directory.",
  path: "/school/transport",
  noIndex: true,
})

export default function TransportLayout({ children }: { children: React.ReactNode }) {
  return <TransportClientLayout>{children}</TransportClientLayout>
}
