import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo/metadata-constants"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // Only public, indexable pages belong in sitemap.
  // Private, admin, teacher, registrar, parent portals, API routes, and password reset screens are strictly excluded.
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ]
}

