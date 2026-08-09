import React from "react"
import { SITE_URL } from "@/lib/seo/metadata-constants"

// ── Organization Schema ─────────────────────────────────────────────────────────
interface OrganizationJsonLdProps {
  name?: string
  url?: string
  logo?: string
  description?: string
}

export function OrganizationJsonLd({
  name = "Addis Hiwot",
  url = SITE_URL,
  logo = `${SITE_URL}/Addis Hiwot-logo.png`,
  description = "School Attendance Management & Communication System for educational institutions.",
}: OrganizationJsonLdProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo,
    description,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["English", "Amharic"],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

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
  name = "Addis Hiwot",
  url = SITE_URL,
  description = "Addis Hiwot School Attendance Management & Communication System — smart attendance tracking, discipline management, and real-time parent notifications.",
  applicationCategory = "EducationApplication",
  operatingSystem = "Web, Android",
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
      "Multi-School Tenant Support",
      "Offline-First PWA",
      "Teacher & Admin Dashboards",
      "Automated Absent Alerts",
      "Communication & Messaging",
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
        : `${SITE_URL}${item.href}`,
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
