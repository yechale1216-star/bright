import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "@/styles/globals.css"
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
import { AcademicYearProvider } from "@/lib/context/academic-year-context"

const inter = localFont({
  src: "../../../public/fonts/inter.woff2",
  variable: "--font-geist-sans",
  display: "swap",
})

const jetbrainsMono = localFont({
  src: "../../../public/fonts/jetbrains-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Bright Path — Student & Parent Portal",
    template: "%s | Bright Path Student & Parent Portal",
  },
  description: "Official Student and Parent Portal for Bright Path. Access grades, attendance, timetables, and communication.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/bright-path-logo.png", sizes: "any", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bright Path",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#2e1065",
}

export default function StudentParentRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground transition-colors duration-200`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
        >
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
