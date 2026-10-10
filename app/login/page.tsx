import LoginPage from "./login-content"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Sign In — Account Access",
  description:
    "Sign in to your Bright Path account to access school attendance management, parent communication portals, and administrative tools.",
  path: "/login",
  noIndex: true, // Login/authentication pages must not appear in search results
})

export default function Page() {
  return <LoginPage />
}
