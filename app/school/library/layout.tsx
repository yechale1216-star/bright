import React from "react"
import LibrarianClientLayout from "@/components/school/librarian-client-layout"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Library Console",
  description: "School Library Catalogue, Circulation, Borrowing, and Inventory Management.",
  path: "/school/library",
  noIndex: true,
})

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <LibrarianClientLayout>{children}</LibrarianClientLayout>
}
