import { type NextRequest, NextResponse } from "next/server"

/** Served from /public — must not redirect (e.g. SW registration rejects redirected scripts). */
const PUBLIC_ROOT_FILES = new Set([
  "/sw.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/bright-path-logo.png",
  "/offline.html",
  "/browserconfig.xml",
  "/icon.svg",
  "/placeholder.svg",
  "/placeholder-logo.svg",
  "/firebase-messaging-sw.js",
  "/firebase-cloud-messaging-push-scope"
])

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const host = request.headers.get("host") || ""

  if (PUBLIC_ROOT_FILES.has(pathname)) {
    return NextResponse.next()
  }

  // API authentication will be handled by individual route handlers
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next()
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    return response
  }

  // Subdomain / Domain Portal Routing:
  // school.<domain> -> School Portal
  // portal.<domain> -> Student & Parent Portal
  const isSchoolDomain = host.startsWith("school.") || host.startsWith("admin.")
  const isPortalDomain = host.startsWith("portal.") || host.startsWith("parent.") || host.startsWith("student.")

  if (isSchoolDomain) {
    // If student/parent route accessed on school domain -> block
    if (pathname.startsWith("/student") || pathname.startsWith("/parent")) {
      return new NextResponse("Access Denied: This portal is for school staff only. Please use the Student & Parent Portal.", { status: 403 })
    }
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/school/login", request.url))
    }
  }

  if (isPortalDomain) {
    // If school route accessed on portal domain -> block
    if (pathname.startsWith("/school")) {
      return new NextResponse("Access Denied: This portal is for students and parents only. Please use the School Portal.", { status: 403 })
    }
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/portal/login", request.url))
    }
  }

  // Public paths that don't require authentication
  const publicPaths = [
    "/",
    "/login",
    "/school/login",
    "/portal/login",
    "/student/login",
    "/forgot-password",
    "/reset-password"
  ]
  const isPublicPath = publicPaths.includes(pathname)

  const isProtectedPath = !isPublicPath

  const sessionToken = request.cookies.get("session")?.value || request.cookies.get("attendance_token")?.value

  if (isProtectedPath && !sessionToken && 
      !pathname.startsWith('/school/') && 
      !pathname.startsWith('/parent/') &&
      !pathname.startsWith('/student/') &&
      !pathname.startsWith('/auth/')) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const response = NextResponse.next()
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-192.png|icon-512.png|offline.html|browserconfig.xml|icon.svg|placeholder.svg|placeholder-logo.svg|firebase-messaging-sw.js|firebase-cloud-messaging-push-scope).*)",
  ],
}
