import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo/metadata-constants"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // Only public, indexable pages belong in the sitemap.
  // This application is a school-management portal — the only meaningful
  // public URL is the root. All authenticated sections (admin, teacher,
  // registrar, parent, staff, discipline-officer) are explicitly excluded,
  // as is the login page (authentication screens must never appear in sitemaps).
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ]
}

