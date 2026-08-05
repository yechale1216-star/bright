import type { Metadata } from "next"

// ── Site-wide constants ─────────────────────────────────────────────────────────
export const SITE_NAME = "Addis Hiwot School"
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zetime.pro.et"
export const DEFAULT_OG_IMAGE = "/zetime_branding_professional.png"
export const TWITTER_HANDLE = "@zetime_app"

export const DEFAULT_DESCRIPTION =
  "Zetime automates attendance tracking, discipline management, and real-time parent notifications for schools across Ethiopia."

export const DEFAULT_KEYWORDS = [
  "school attendance",
  "attendance tracking",
  "student attendance management",
  "school management system",
  "parent notifications",
  "discipline management",
  "Ethiopia schools",
  "education technology",
  "SaaS school platform",
  "teacher tools",
  "Zetime",
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
