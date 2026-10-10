import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { LanguageProvider } from "@/lib/context/language-context"
import { CalendarProvider } from "@/lib/context/calendar-context"
import { SchoolProvider } from "@/lib/context/school-context"
import { AuthProvider } from "@/lib/context/auth-context"
import { Toaster as SonnerToaster } from "sonner"
import { PWAClientWrapper } from "@/components/system/pwa-client-wrapper"
import { FetchInterceptor } from "@/components/providers/fetch-interceptor"
import { CapacitorInitializer } from "@/components/capacitor-initializer"
import { StartupLoadingScreen } from "@/components/system/startup-loading-screen"
import { GlobalOfflineOverlay } from "@/components/system/global-offline-overlay"
import { InAppNotificationProvider } from "@/components/providers/in-app-notification-provider"
import { SocketProvider } from "@/components/providers/socket-provider"
import { UnreadProvider } from "@/lib/context/unread-context"
import { CallProvider } from "@/components/providers/call-provider"
import { SchoolJsonLd } from "@/components/seo/json-ld"
import { AcademicYearProvider } from "@/lib/context/academic-year-context"
import {
  SITE_NAME,
  SCHOOL_FULL_NAME,
  SITE_URL,
  DEFAULT_OG_IMAGE,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  TWITTER_HANDLE,
  DEVELOPER_NAME,
} from "@/lib/seo/metadata-constants"

const inter = localFont({
  src: "../public/fonts/inter.woff2",
  variable: "--font-geist-sans",
  display: "swap",
})

const jetbrainsMono = localFont({
  src: "../public/fonts/jetbrains-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Digital School Management & Communication Platform`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SCHOOL_FULL_NAME }, { name: DEVELOPER_NAME }],
  creator: DEVELOPER_NAME,
  publisher: SCHOOL_FULL_NAME,
  category: "education",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/bright-path-logo.png", sizes: "any", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: ["/icon-192.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    // Use the absolute URL so the canonical is always https://ahs.pro.et/ —
    // never a relative path that could resolve against a wrong base.
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
        alt: `${SITE_NAME} — Digital School Management Platform (Developed by ${DEVELOPER_NAME})`,
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
  verification: {
    google: "h_87sQ6J11rElUbRMtvQghzY0vY_0rvLaBytdcLdjwQ",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#1a3a6b",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <SchoolJsonLd />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          {/* Global offline wall — sits above every page at z-[9999] */}
          <GlobalOfflineOverlay />
          <FetchInterceptor>
            <LanguageProvider>
              <CalendarProvider>
                <AuthProvider>
                  <CapacitorInitializer />
                  <StartupLoadingScreen />
                  <SchoolProvider>
                    <AcademicYearProvider>
                      <SocketProvider>
                        <UnreadProvider>
                          <CallProvider>
                            <InAppNotificationProvider>
                              {children}
                            </InAppNotificationProvider>
                          </CallProvider>
                        </UnreadProvider>
                      </SocketProvider>
                      <Toaster />
                      <SonnerToaster position="top-right" richColors visibleToasts={2} />
                      <PWAClientWrapper />
                    </AcademicYearProvider>
                  </SchoolProvider>
                </AuthProvider>
              </CalendarProvider>
            </LanguageProvider>
          </FetchInterceptor>
        </ThemeProvider>
      </body>
    </html>
  )
}
