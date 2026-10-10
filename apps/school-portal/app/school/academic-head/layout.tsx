import React from "react"
import AcademicHeadClientLayout from "@/components/school/academic-head-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Academic Coordination Console",
  description: "Curriculum oversight, assessment policies, grading workflows, and academic examinations.",
  path: "/school/academic-head",
  noIndex: true,
})

export default function AcademicHeadLayout({ children }: { children: React.ReactNode }) {
  return <AcademicHeadClientLayout>{children}</AcademicHeadClientLayout>
}
