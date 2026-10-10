import React from "react"
import RegistrarClientLayout from "@/components/school/registrar-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Registrar Console",
  description: "Student registration, records management, and enrollment reports.",
  path: "/school/registrar",
  noIndex: true,
})

export default function RegistrarLayout({ children }: { children: React.ReactNode }) {
  return <RegistrarClientLayout>{children}</RegistrarClientLayout>
}
