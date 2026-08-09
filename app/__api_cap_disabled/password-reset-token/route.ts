import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { user_id, token_hash, expires_at } = await request.json()

    if (!user_id || !token_hash || !expires_at) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/password_reset_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      },
      body: JSON.stringify({
        user_id,
        token_hash,
        expires_at,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Failed to store reset token:", error)
      return NextResponse.json({ success: false, error: "Failed to store reset token" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Password reset token error:", error)
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 })
  }
}

