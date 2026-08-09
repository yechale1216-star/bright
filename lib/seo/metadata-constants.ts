import type { Metadata } from "next"

// ── Site-wide constants ─────────────────────────────────────────────────────────
export const SITE_NAME = "Addis Hiwot"
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zetime.pro.et"
export const DEFAULT_OG_IMAGE = "/Addis Hiwot-logo.png"
export const TWITTER_HANDLE = "@AddisHiwot"

export const DEFAULT_DESCRIPTION =
  "Addis Hiwot School Attendance Management & Communication System — smart attendance tracking, discipline management, and real-time parent notifications."

export const DEFAULT_KEYWORDS = [
  "Addis Hiwot",
  "school attendance",
  "attendance tracking",
  "student attendance management",
  "school management system",
  "parent notifications",
  "discipline management",
  "Ethiopia schools",
  "education technology",
  "communication system",
  "teacher tools",
]

// ── Helper: build a fully-formed Metadata object ────────────────────────────────
interface PageMetadataOptions {
  /** Page-specific title (will be templated as "title | Zetime") */
  title: string
  /** Page-specific description (≤ 160 chars recommended) */
  description: string
  /** Path segment, e.g. "/about" — used for canonical URL */
  path?: string
  /** Override default OG image */
  ogImage?: string
  /** If true, sets robots to noindex/nofollow (for authenticated pages) */
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
  const url = `${SITE_URL}${path}`
  const image = ogImage || DEFAULT_OG_IMAGE

  const metadata: Metadata = {
    title,
    description,
    keywords: keywords
      ? [...DEFAULT_KEYWORDS, ...keywords]
      : DEFAULT_KEYWORDS,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: "en_US",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${title} — ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      title,
      description,
      images: [image],
    },
  }

  if (noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    }
  }

  return metadata
}
