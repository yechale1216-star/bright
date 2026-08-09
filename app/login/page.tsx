import LoginPage from "./login-content"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Sign In — Account Access",
  description:
    "Sign in to your Addis Hiwot account to access school attendance management, parent communication portals, and administrative tools.",
  path: "/login",
})

export default function Page() {
  return <LoginPage />
}
