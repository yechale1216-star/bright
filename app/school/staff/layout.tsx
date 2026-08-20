import StaffClientLayout from "@/components/school/staff-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Staff Member Portal",
  description: "Addis Hiwot Staff Member Portal - Attendance, announcements, and school communication.",
  path: "/school/staff",
  noIndex: true, // Authenticated staff portal — must not be indexed
})

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffClientLayout>{children}</StaffClientLayout>
}
