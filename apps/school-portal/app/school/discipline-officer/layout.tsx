import React from "react"
import DisciplineOfficerClientLayout from "@/components/school/discipline-officer-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Discipline Portal",
  description: "Record, manage, and investigate student conduct and discipline incidents.",
  path: "/school/discipline-officer",
  noIndex: true,
})

export default function DisciplineOfficerLayout({ children }: { children: React.ReactNode }) {
  return <DisciplineOfficerClientLayout>{children}</DisciplineOfficerClientLayout>
}
