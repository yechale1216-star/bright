import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json()

    if (!email || !token) {
      return NextResponse.json({ valid: false, error: "Email and token are required" }, { status: 400 })
    }

    // Hash the token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/password_reset_tokens?token_hash=eq.${tokenHash}&user_id=eq.(SELECT id FROM users WHERE email='${email}')`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        },
      },
    )

    if (!response.ok) {
      return NextResponse.json({ valid: false, error: "Failed to verify token" }, { status: 400 })
    }

    const data = await response.json()
    const tokenRecord = data[0]

    if (!tokenRecord) {
      return NextResponse.json({ valid: false, error: "Invalid or expired token" }, { status: 400 })
    }

    // Check if token has expired
    const expiresAt = new Date(tokenRecord.expires_at)
    if (expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: "Token has expired" }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      userId: tokenRecord.user_id,
    })
  } catch (error) {
    console.error("Verify reset token error:", error)
    return NextResponse.json({ valid: false, error: "An error occurred verifying the token" }, { status: 500 })
  }
}

