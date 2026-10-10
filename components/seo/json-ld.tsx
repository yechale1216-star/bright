import React from "react"
import {
  SITE_URL,
  SITE_NAME,
  SCHOOL_FULL_NAME,
  SCHOOL_AMHARIC_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEVELOPER_NAME,
} from "@/lib/seo/metadata-constants"

// ── Default Platform Core Capabilities ─────────────────────────────────────────
export const BRIGHT_PATH_FEATURES = [
  "Student attendance management (daily roll-calls, multi-session tracking, automated late/absent parent alerts)",
  "Staff attendance management with on-device AI neural face biometric verification and school GPS geofencing",
  "Student discipline management (incident logging, hearings, severity matrices, corrective actions, and parent digital acknowledgments)",
  "School-wide announcements and targeted multi-channel communication (push notifications, SMS, email)",
  "Real-time parent-school communication with in-app messaging, push notifications, and direct contact",
  "Student and staff lifecycle management (admissions, auto-generated sequential student IDs, class rosters, annual cohort batch promotions)",
  "Role-based school administrative dashboards with operational transparency and real-time analytics",
  "Dedicated Parent Portal for monitoring student attendance, behavioral records, schedules, and school notices",
  "Dedicated Teacher & Staff Portal with 1-tap roll calls and offline IndexedDB background synchronization",
  "Granular role-based access workflows for Super Admins, Principals, Registrars, Discipline Officers, Teachers, and Parents",
  "Full bilingual interface support in English and Amharic (አማርኛ) with native Ethiopian Calendar (E.C.) integration",
  "Secure, centralized digital school management ensuring biometric privacy and zero raw photo storage",
]

// backwards compat alias
export const ADDIS_HIWOT_FEATURES = BRIGHT_PATH_FEATURES

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
        alternateName: [SCHOOL_AMHARIC_NAME, SITE_NAME, "Bright Path School Management Platform"],
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
        name: `${SITE_NAME} — Digital School Management & Communication Platform`,
        alternateName: [SCHOOL_AMHARIC_NAME, "Bright Path Portal", "ahs.pro.et"],
        description,
        publisher: {
          "@id": `${url}/#school`,
        },
        creator: {
          "@type": "Person",
          name: DEVELOPER_NAME,
          jobTitle: "Lead Developer & System Architect",
        },
        inLanguage: ["en-US", "am-ET"],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}/#application`,
        name: "Bright Path Digital School Management Platform",
        alternateName: [
          "Bright Path School Management Suite",
          "ብራይት ፓዝ የትምህርት ቤት አስተዳደር ሥርዓት",
          "Bright Path Attendance & Communication System",
        ],
        applicationCategory: "BusinessApplication, EducationalApplication",
        operatingSystem: "Web, Android (Capacitor Native & PWA), iOS",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        softwareVersion: "2.0.0",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "ETB",
        },
        featureList: ADDIS_HIWOT_FEATURES,
        author: {
          "@type": "Person",
          name: DEVELOPER_NAME,
          jobTitle: "Lead Developer & System Architect",
        },
        creator: {
          "@type": "Person",
          name: DEVELOPER_NAME,
        },
        maintainer: {
          "@type": "Person",
          name: DEVELOPER_NAME,
        },
        description,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Bright Path?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Bright Path is a comprehensive digital school management and communication platform developed by ${DEVELOPER_NAME}. It modernizes K-12 school administration by uniting student attendance tracking, AI face biometric staff attendance with GPS geofencing, discipline management, parent-teacher communication, and student-staff lifecycle management into a single centralized system.`,
            },
          },
          {
            "@type": "Question",
            name: "Who is Bright Path designed for?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Bright Path is designed for entire school communities, featuring dedicated role-based portals for School Administrators, Principals, Registrars, Discipline Officers, Homeroom Teachers, Subject Teachers, Support Staff, and Parents.",
            },
          },
          {
            "@type": "Question",
            name: "What are the core capabilities and modules of Bright Path?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The platform's major features include: 1) Student attendance management with multi-session tracking and instant absence alerts; 2) Staff attendance with neural 128-d face biometric verification and GPS school geofencing; 3) Student discipline and behavioral incident management with tiered corrective actions; 4) School-wide multilingual announcements; 5) Real-time parent-school communication with push notifications and direct messaging; 6) Student and staff lifecycle management including sequential auto ID generation and annual cohort promotions; 7) Executive school administration dashboards; 8) Parent and Teacher portals; 9) English and Amharic language support; and 10) Offline-first IndexedDB synchronization.",
            },
          },
          {
            "@type": "Question",
            name: "Who developed Bright Path?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Bright Path was developed by ${DEVELOPER_NAME} as a secure, purpose-built educational administration and communication platform.`,
            },
          },
          {
            "@type": "Question",
            name: "How does staff biometric attendance verification work in Bright Path?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Staff members verify check-in and check-out on their own mobile portal or workstation. The system combines GPS school geofencing with on-device TensorFlow.js neural face matching (threshold ≤ 0.42) against the enrolled biometric vector, operating in sub-second speed with total biometric privacy and zero raw photo storage.",
            },
          },
          {
            "@type": "Question",
            name: "Does Bright Path support the Ethiopian Calendar and Amharic language?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Bright Path provides full native bilingual support in both English and Amharic (አማርኛ), including dual Ethiopian Calendar (E.C.) and Gregorian Calendar (G.C.) conversion, scheduling, and date pickers.",
            },
          },
        ],
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
  name = `${SITE_NAME} Digital School Management Platform`,
  url = SITE_URL,
  description = DEFAULT_DESCRIPTION,
  applicationCategory = "EducationalApplication, BusinessApplication",
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
    author: {
      "@type": "Person",
      name: DEVELOPER_NAME,
    },
    creator: {
      "@type": "Person",
      name: DEVELOPER_NAME,
    },
    featureList: ADDIS_HIWOT_FEATURES,
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
