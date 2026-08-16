import React from "react"
import {
  SITE_URL,
  SITE_NAME,
  SCHOOL_FULL_NAME,
  SCHOOL_AMHARIC_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo/metadata-constants"

// ── School & Educational Organization Schema ────────────────────────────────────
interface SchoolJsonLdProps {
  name?: string
  url?: string
  logo?: string
  description?: string
}

export function SchoolJsonLd({
  name = SCHOOL_FULL_NAME,
  url = SITE_URL,
  logo = `${SITE_URL}${DEFAULT_OG_IMAGE}`,
  description = DEFAULT_DESCRIPTION,
}: SchoolJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["EducationalOrganization", "School"],
        "@id": `${url}/#school`,
        name,
        alternateName: [SCHOOL_AMHARIC_NAME, SITE_NAME, "Addis Hiwot School Portal"],
        url,
        logo: {
          "@type": "ImageObject",
          "@id": `${url}/#logo`,
          url: logo,
          caption: `${name} Logo`,
        },
        image: logo,
        description,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Addis Ababa",
          addressCountry: "ET",
        },
        inLanguage: ["en", "am"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "administrative support",
          availableLanguage: ["English", "Amharic"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: SITE_NAME,
        alternateName: SCHOOL_AMHARIC_NAME,
        description,
        publisher: {
          "@id": `${url}/#school`,
        },
        inLanguage: ["en-US", "am-ET"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}/#application`,
        name: `${SITE_NAME} Attendance & Communication Suite`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web, Android, iOS",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        softwareVersion: "1.0.0",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "ETB",
        },
        featureList: [
          "Student Attendance Tracking and Session Monitoring",
          "Real-time Parent Absent & Late Notifications",
          "Student Conduct and Discipline Management",
          "Multi-role Teacher, Admin, Registrar & Parent Portals",
          "Offline-first Progressive Web App (PWA)",
        ],
        author: {
          "@id": `${url}/#school`,
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// Backward compatibility alias for OrganizationJsonLd
export const OrganizationJsonLd = SchoolJsonLd

// ── WebApplication Schema ───────────────────────────────────────────────────────
interface WebApplicationJsonLdProps {
  name?: string
  url?: string
  description?: string
  applicationCategory?: string
  operatingSystem?: string
  offers?: {
    price: string
    priceCurrency: string
  }
}

export function WebApplicationJsonLd({
  name = `${SITE_NAME} Portal`,
  url = SITE_URL,
  description = DEFAULT_DESCRIPTION,
  applicationCategory = "EducationalApplication",
  operatingSystem = "Web, Android, iOS",
  offers = { price: "0", priceCurrency: "ETB" },
}: WebApplicationJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    url,
    description,
    applicationCategory,
    operatingSystem,
    offers: {
      "@type": "Offer",
      ...offers,
    },
    featureList: [
      "Daily & Session-Based Attendance Tracking",
      "Student Discipline Management",
      "Real-Time Parent Notifications",
      "Multi-Role Access Control",
      "Offline-First PWA Support",
      "Teacher & Admin Dashboards",
      "Automated Absent Alerts",
      "Direct Communication & Messaging",
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ── Breadcrumb Schema ───────────────────────────────────────────────────────────
interface BreadcrumbItem {
  name: string
  href: string
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href.startsWith("http")
        ? item.href
        : `${SITE_URL}${item.href.startsWith("/") ? item.href : `/${item.href}`}`,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

// ── FAQ Schema ──────────────────────────────────────────────────────────────────
interface FAQItem {
  question: string
  answer: string
}

interface FAQJsonLdProps {
  items: FAQItem[]
}

export function FAQJsonLd({ items }: FAQJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
