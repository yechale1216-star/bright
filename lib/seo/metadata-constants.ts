import type { Metadata } from "next"

// ── Site-wide constants & Canonical URL Helper ──────────────────────────────────
function resolveSiteUrl(): string {
  // Priority order:
  // 1. NEXT_PUBLIC_SITE_URL — explicitly set canonical production URL (preferred)
  // 2. VERCEL_PROJECT_PRODUCTION_URL — Vercel automatically sets this for the production deployment
  // 3. Hardcoded canonical production domain as a safe fallback
  //
  // NOTE: NEXT_PUBLIC_APP_URL is intentionally excluded — in this project it
  // resolves to the backend API server URL, not the frontend canonical URL.
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://ahs.pro.et")
  // Strip trailing slashes to ensure uniform canonical URLs
  return rawUrl.replace(/\/+$/, "")
}

export const SITE_NAME = "Addis Hiwot"
export const SCHOOL_FULL_NAME = "Addis Hiwot School"
export const SCHOOL_AMHARIC_NAME = "አዲስ ህይወት ት/ቤት"
export const SITE_URL = resolveSiteUrl()
export const DEFAULT_OG_IMAGE = "/addis-hiwot-logo.png"
export const TWITTER_HANDLE = "@AddisHiwot"

export const DEFAULT_DESCRIPTION =
  "Addis Hiwot School Attendance Management & Communication System — smart student attendance tracking, discipline records management, and real-time parent notifications in Addis Ababa, Ethiopia."

export const DEFAULT_KEYWORDS = [
  "Addis Hiwot",
  "Addis Hiwot School",
  "አዲስ ህይወት ት/ቤት",
  "school attendance management",
  "Ethiopia school portal",
  "Addis Ababa schools",
  "student attendance tracking",
  "parent notification system",
  "school discipline management",
  "education management Ethiopia",
  "teacher attendance app",
  "parent school communication",
]

// ── Helper: build a fully-formed Metadata object ────────────────────────────────
interface PageMetadataOptions {
  /** Page-specific title (will be templated as "title | Addis Hiwot") */
  title: string
  /** Page-specific description (≤ 160 chars recommended) */
  description: string
  /** Path segment, e.g. "/login" — used for canonical URL */
  path?: string
  /** Override default OG image */
  ogImage?: string
  /** If true, sets robots to noindex/nofollow (for authenticated/private pages) */
  noIndex?: boolean
  /** Additional keywords to merge with defaults */
  keywords?: string[]
  /** Override OG type (default: "website") */
  ogType?: "website" | "article"
}

export function createPageMetadata({
  title,
  description,
  path = "",
  ogImage,
  noIndex = false,
  keywords,
  ogType = "website",
}: PageMetadataOptions): Metadata {
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  const canonicalUrl = `${SITE_URL}${cleanPath === "/" ? "" : cleanPath}`
  const image = ogImage || DEFAULT_OG_IMAGE
  const fullImageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`

  const metadata: Metadata = {
    title,
    description,
    keywords: keywords
      ? [...DEFAULT_KEYWORDS, ...keywords]
      : DEFAULT_KEYWORDS,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        "en-US": canonicalUrl,
        "am-ET": canonicalUrl,
      },
    },
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonicalUrl,
      locale: "en_US",
      alternateLocale: ["am_ET"],
      images: [
        {
          url: fullImageUrl,
          width: 1200,
          height: 630,
          alt: `${title} — ${SCHOOL_FULL_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [fullImageUrl],
    },
  }

  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "none",
        "max-snippet": -1,
      },
    }
  } else {
    metadata.robots = {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    }
  }

  return metadata
}
