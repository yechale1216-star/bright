import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { appUrl } from "@/lib/api-config"
import { createServerSupabaseClient } from "@/lib/utils/supabase-server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("email", email)
      .eq("is_active", true)
      .limit(1)

    if (userError) {
      console.error("[v0] Error fetching user:", userError)
      // For security, don't reveal if email exists
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you'll receive reset instructions shortly.",
      })
    }

    if (!users || users.length === 0) {
      // For security, don't reveal if email exists - always return success
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you'll receive reset instructions shortly.",
      })
    }

    const user = users[0]

    // Generate a reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex")
    const resetTokenExpires = new Date(Date.now() + 3600000) // 1 hour

    const { error: storeError } = await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token_hash: resetTokenHash,
      expires_at: resetTokenExpires.toISOString(),
      created_at: new Date().toISOString(),
    })

    if (storeError) {
      console.error("[v0] Error storing reset token:", storeError)
      // Still return success for security
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you'll receive reset instructions shortly.",
      })
    }

    // Send reset email
    const resetLink = `${appUrl}/reset-password?token=${resetToken}`

    const emailContent = `
Hello ${user.full_name || user.email},

We received a request to reset your password. Click the link below to reset it:

${resetLink}

This link will expire in 1 hour.

If you didn't request this, you can ignore this email.

Best regards,
Smart Attendance System
    `.trim()

    const response = await fetch(`${appUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject: "Reset Your Password",
        text: emailContent,
        html: emailContent.replace(/\n/g, "<br>"),
      }),
    })

    if (!response.ok) {
      console.error("[v0] Failed to send reset email - Status:", response.status)
      // Still return success for security
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you'll receive reset instructions shortly.",
      })
    }

    let emailData
    try {
      emailData = await response.json()
    } catch (parseError) {
      console.error("[v0] Error parsing email response:", parseError)
      // Email was sent but we couldn't parse response, still consider it success
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, you'll receive reset instructions shortly.",
      })
    }

    console.log("[v0] Reset email sent successfully")
    return NextResponse.json({
      success: true,
      message: "If an account with this email exists, you'll receive reset instructions shortly.",
    })
  } catch (error) {
    console.error("[v0] Forgot password error:", error)
    return NextResponse.json({
      success: true,
      message: "If an account with this email exists, you'll receive reset instructions shortly.",
    })
  }
}


