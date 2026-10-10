import React from "react"
import ParentClientLayout from "@/components/parent/client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Parent Portal",
  description: "Monitor student attendance, discipline reports, and communicate with teachers.",
  path: "/parent",
  noIndex: true,
})

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <ParentClientLayout>{children}</ParentClientLayout>
}
