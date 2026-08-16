import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo/metadata-constants"

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
          "/login",
          "/manifest.json",
          "/icon-192.png",
          "/icon-512.png",
          "/addis-hiwot-logo.png",
          "/zetime-logo.png",
          "/fonts/",
        ],
        disallow: [
          "/school/",
          "/parent/",
          "/api/",
          "/reset-password/",
          "/setup/",
          "/auth/",
          "/_next/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

