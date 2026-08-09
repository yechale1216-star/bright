import { Suspense } from "react"
import ResetPasswordPageContent from "./reset-password-content"
import { createPageMetadata } from "@/lib/seo/metadata-constants"

export const metadata = createPageMetadata({
  title: "Reset Password",
  description: "Reset your Addis Hiwot account password securely.",
  path: "/reset-password",
  noIndex: true,
})

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}
