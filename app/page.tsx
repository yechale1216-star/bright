import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import HomeRedirect from "./home-redirect"
import {
  SITE_URL,
  SITE_NAME,
  SCHOOL_FULL_NAME,
  SCHOOL_AMHARIC_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  TWITTER_HANDLE,
  DEVELOPER_NAME,
  DEVELOPER_ATTRIBUTION,
} from "@/lib/seo/metadata-constants"

/**
 * Root Page Metadata for https://ahs.pro.et/
 *
 * Provides comprehensive SEO and AI-search discoverability data
 * for Googlebot, Google AI Overviews, Gemini, Perplexity, GPTBot, and Applebot.
 */
export const metadata: Metadata = {
  title: `${SITE_NAME} — Digital School Management & Communication Platform`,
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SCHOOL_FULL_NAME }, { name: DEVELOPER_NAME }],
  creator: DEVELOPER_NAME,
  publisher: SCHOOL_FULL_NAME,
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
    siteName: `${SITE_NAME} — Digital School Management & Communication Platform`,
    title: `${SITE_NAME} — Digital School Management & Communication Platform`,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["am_ET"],
    images: [
      {
        url: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Digital School Management Platform (${DEVELOPER_ATTRIBUTION})`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: `${SITE_NAME} — Digital School Management & Communication Platform`,
    description: DEFAULT_DESCRIPTION,
    images: [`${SITE_URL}${DEFAULT_OG_IMAGE}`],
  },
}

/**
 * Server component for the root route.
 *
 * Renders rich semantic HTML for search engines, AI crawlers, and accessibility,
 * while mounting <HomeRedirect /> for seamless client-side user dashboard routing.
 */
export default function Page() {
  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Client-side automatic router for active users */}
      <HomeRedirect />

      {/* Semantic Crawlable Header & Main Content for Search Engines & AI Crawlers */}
      <header className="border-b border-slate-800/80 bg-[#0a1224]/80 backdrop-blur-md px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={DEFAULT_OG_IMAGE}
              alt="Addis Hiwot School Official Crest and Logo"
              width={44}
              height={44}
              className="rounded-xl shadow-md border border-slate-700/50"
              priority
            />
            <div>
              <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>{SCHOOL_FULL_NAME}</span>
                <span className="text-xs font-semibold text-blue-400">({SCHOOL_AMHARIC_NAME})</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">{DEVELOPER_ATTRIBUTION}</p>
            </div>
          </div>
          <nav aria-label="Quick Access" className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-600/20"
            >
              Sign In to Portal
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-12">
        {/* Executive Hero Statement */}
        <section className="space-y-4 text-center sm:text-left max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider">
            Enterprise Educational Management Suite
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Addis Hiwot Digital School Management & Communication Platform
          </h1>
          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
            Addis Hiwot is a comprehensive, purpose-built educational administration platform developed by{" "}
            <strong className="text-white font-bold">{DEVELOPER_NAME}</strong>. It eliminates paper friction and unifies
            student attendance tracking, AI face biometric staff attendance, student discipline workflows, parent-teacher
            communication, and academic record management into a secure, centralized digital hub for modern schools in Addis Ababa, Ethiopia.
          </p>
        </section>

        {/* Platform Pillars Grid */}
        <section aria-labelledby="core-capabilities" className="space-y-6">
          <h2 id="core-capabilities" className="text-xl sm:text-2xl font-black text-white tracking-tight border-b border-slate-800 pb-3">
            Core Modules & Major Platform Capabilities
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-blue-400">1. Student Attendance Management</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Homeroom and subject roll-calls with instant multi-session tracking (Morning & Afternoon). Supports 1-tap bulk marking, automated status classifications (Present, Absent, Late, Excused), and real-time parent alert triggers.
              </p>
            </article>

            {/* Pillar 2 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-emerald-400">2. Staff Biometric Face Self-Attendance</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sub-second AI neural face vector verification combined with school GPS geofencing. Enforces authentic on-premise check-in and check-out from staff mobile devices with total biometric privacy and zero raw photo storage.
              </p>
            </article>

            {/* Pillar 3 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-rose-400">3. Student Discipline & Conduct Tracking</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Centralized behavioral incident reporting with digital evidence attachments, tiered severity matrices (Low to Critical), formal hearing logs, corrective action assignments, and mandatory parent digital acknowledgments.
              </p>
            </article>

            {/* Pillar 4 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-purple-400">4. Parent-School Real-Time Communication</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Instant Firebase Cloud Messaging (FCM) push notifications, in-app direct messaging between parents and teachers, high-priority automated absence notifications, and VoIP direct contact.
              </p>
            </article>

            {/* Pillar 5 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-amber-400">5. Student & Staff Lifecycle Management</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Automated sequential student ID generation, sibling auto-linking, smart phone parent lookups, class roster distribution, staff role assignments, and 1-click batch annual cohort promotions.
              </p>
            </article>

            {/* Pillar 6 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-cyan-400">6. School Executive & Role-Based Portals</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tailored workflows and dedicated dashboards for Super Admins, Principals, Vice Principals, Registrars, Discipline Officers, Homeroom Teachers, Subject Teachers, Support Staff, and Parents.
              </p>
            </article>

            {/* Pillar 7 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-indigo-400">7. Bilingual English & Amharic Engine</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Complete bilingual interface switching between English and Amharic (አማርኛ), with native Ethiopian Calendar (E.C.) and Gregorian Calendar (G.C.) dual conversions, schedule pickers, and localized formatting.
              </p>
            </article>

            {/* Pillar 8 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-teal-400">8. Offline-First Synchronization Architecture</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Progressive Web App (PWA) with client-side IndexedDB caching and an automated background synchronization queue, allowing teachers to record attendance during connectivity outages and auto-sync when online.
              </p>
            </article>

            {/* Pillar 9 */}
            <article className="p-5 rounded-2xl bg-[#0d172e] border border-slate-800/80 shadow-lg space-y-2.5">
              <h3 className="text-base font-bold text-sky-400">9. Secure, Centralized Digital Governance</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enterprise security with JWT authentication, role-based authorization guards, comprehensive audit logging, multi-session management, and full data protection across web and mobile platforms.
              </p>
            </article>
          </div>
        </section>

        {/* Structured Q&A for Search & AI Discoverability */}
        <section aria-labelledby="platform-faq" className="space-y-6">
          <h2 id="platform-faq" className="text-xl sm:text-2xl font-black text-white tracking-tight border-b border-slate-800 pb-3">
            Frequently Asked Questions & Platform Overview
          </h2>
          <div className="space-y-4 text-xs sm:text-sm">
            <details className="p-4 rounded-xl bg-[#0d172e] border border-slate-800/70 open:bg-[#101c38]">
              <summary className="font-bold text-slate-100 cursor-pointer">What is the Addis Hiwot platform?</summary>
              <p className="mt-2 text-slate-300 leading-relaxed">
                Addis Hiwot is a modern digital school management and communication platform developed by {DEVELOPER_NAME}. It serves as the all-in-one administrative hub for Addis Hiwot School, managing student attendance, staff biometric verification, disciplinary incidents, parent communication, and academic promotions.
              </p>
            </details>
            <details className="p-4 rounded-xl bg-[#0d172e] border border-slate-800/70 open:bg-[#101c38]">
              <summary className="font-bold text-slate-100 cursor-pointer">Who is the developer of Addis Hiwot?</summary>
              <p className="mt-2 text-slate-300 leading-relaxed">
                Addis Hiwot was designed, engineered, and developed by {DEVELOPER_NAME} ({DEVELOPER_ATTRIBUTION}).
              </p>
            </details>
            <details className="p-4 rounded-xl bg-[#0d172e] border border-slate-800/70 open:bg-[#101c38]">
              <summary className="font-bold text-slate-100 cursor-pointer">How do parents and staff access the platform?</summary>
              <p className="mt-2 text-slate-300 leading-relaxed">
                Users can log into their dedicated portal via <Link href="/login" className="text-blue-400 underline font-semibold">ahs.pro.et/login</Link> using their assigned credentials. Parents can view attendance, behavior records, and notifications, while staff and teachers can mark rolls and manage classroom workflows.
              </p>
            </details>
          </div>
        </section>
      </main>

      {/* Semantic Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0a1224] px-4 sm:px-8 py-6 text-center text-xs text-slate-400 space-y-2">
        <p className="font-medium text-slate-300">
          &copy; {new Date().getFullYear()} {SCHOOL_FULL_NAME} ({SCHOOL_AMHARIC_NAME}) &bull; All Rights Reserved.
        </p>
        <p className="font-bold tracking-wide text-[#FF8000]">
          {DEVELOPER_ATTRIBUTION}
        </p>
      </footer>
    </div>
  )
}
