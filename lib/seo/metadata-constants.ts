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
export const DEVELOPER_NAME = "Yechale"
export const DEVELOPER_ATTRIBUTION = "Developed by Yechale"

export const DEFAULT_DESCRIPTION =
  "Addis Hiwot is a comprehensive digital school management and communication platform developed by Yechale. Features student and staff attendance management with biometric face verification, student discipline tracking, parent-teacher communication, multi-role school dashboards, and full English & Amharic language support in Addis Ababa, Ethiopia."

export const DEFAULT_KEYWORDS = [
  "Addis Hiwot",
  "Addis Hiwot School",
  "አዲስ ህይወት ት/ቤት",
  "ahs.pro.et",
  "Developed by Yechale",
  "digital school management platform",
  "Ethiopia school management system",
  "student attendance management",
  "staff attendance biometric face verification",
  "AI face attendance school",
  "student discipline management",
  "school incident tracking",
  "parent school communication",
  "parent portal Ethiopia",
  "teacher portal attendance",
  "school administrative dashboards",
  "role-based school management",
  "English Amharic school software",
  "Ethiopian calendar school system",
  "Addis Ababa education technology",
  "offline-first school PWA",
  "centralized digital school management",
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
    authors: [{ name: SCHOOL_FULL_NAME }, { name: DEVELOPER_NAME }],
    creator: DEVELOPER_NAME,
    publisher: SCHOOL_FULL_NAME,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        "en-US": canonicalUrl,
        "am-ET": canonicalUrl,
      },
    },
    openGraph: {
      type: ogType,
      siteName: `${SITE_NAME} — Digital School Management & Communication Platform`,
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
          alt: `${title} — ${SCHOOL_FULL_NAME} (Developed by ${DEVELOPER_NAME})`,
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
