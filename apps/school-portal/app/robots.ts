import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo/metadata-constants"

export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
  const isDevOrLocal =
    process.env.NODE_ENV !== "production" ||
    SITE_URL.includes("localhost") ||
    SITE_URL.includes("127.0.0.1") ||
    SITE_URL.includes(".local")

  // Prevent indexing on local dev or preview environments
  if (isDevOrLocal) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    }
  }

  // Production robots configuration
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          // Allow static assets required for page rendering
          "/manifest.json",
          "/icon-192.png",
          "/icon-512.png",
          "/addis-hiwot-logo.png",
          "/fonts/",
        ],
        disallow: [
          // Private application portals — authenticated users only
          "/school/",
          "/parent/",
          "/api/",
          "/reset-password/",
          "/setup/",
          "/auth/",
          // NOTE: /_next/ is intentionally NOT disallowed.
          // Googlebot requires access to Next.js JS/CSS chunks to render pages.
          // Blocking /_next/ prevents proper page indexing (Google renders JavaScript).
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

