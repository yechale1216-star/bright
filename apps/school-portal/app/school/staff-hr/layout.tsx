import React from "react"
import StaffHrClientLayout from "@/components/school/staff-hr-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Staff Operations & HR Desk",
  description: "Live staff timekeeping, biometric registration, leave management, and employee attendance logs.",
  path: "/school/staff-hr",
  noIndex: true,
})

export default function StaffHrLayout({ children }: { children: React.ReactNode }) {
  return <StaffHrClientLayout>{children}</StaffHrClientLayout>
}
