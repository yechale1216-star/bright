import React from "react"
import SchoolAdminClientLayout from "@/components/school/admin-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "School Administration Console",
  description: "Administrative dashboard for managing students, teachers, attendance, and institution settings.",
  path: "/school/admin",
  noIndex: true,
})

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  return <SchoolAdminClientLayout>{children}</SchoolAdminClientLayout>
}
