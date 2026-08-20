import type { Metadata } from "next"
import HomeRedirect from "./home-redirect"
import {
  SITE_URL,
  SITE_NAME,
  SCHOOL_FULL_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  TWITTER_HANDLE,
} from "@/lib/seo/metadata-constants"

/**
 * Root page metadata for https://ahs.pro.et/
 *
 * This is the only publicly indexed URL for the Addis Hiwot school portal.
 * The page itself redirects authenticated users to their dashboard and
 * unauthenticated users to /login, but the metadata is what Google indexes.
 */
export const metadata: Metadata = {
  title: `${SITE_NAME} — Addis Ababa School Management & Parent Communication`,
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SCHOOL_FULL_NAME }, { name: "Ethio Nova" }],
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
      "am-ET": SITE_URL,
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Addis Ababa School Management & Parent Communication`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["am_ET"],
    images: [
      {
        url: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — School Attendance & Parent Notification System, Addis Ababa`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: `${SITE_NAME} — Addis Ababa School Management & Parent Communication`,
    description: DEFAULT_DESCRIPTION,
    images: [`${SITE_URL}${DEFAULT_OG_IMAGE}`],
  },
}

/**
 * Server component wrapper for the root route.
 * Renders the client-side redirect logic via <HomeRedirect>.
 */
export default function Page() {
  return <HomeRedirect />
}

