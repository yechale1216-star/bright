import React from "react"
import TeacherClientLayout from "@/components/school/teacher-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Teacher Portal",
  description: "Mark attendance, record discipline incidents, and communicate with parents.",
  path: "/school/teacher",
  noIndex: true,
})

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <TeacherClientLayout>{children}</TeacherClientLayout>
}
