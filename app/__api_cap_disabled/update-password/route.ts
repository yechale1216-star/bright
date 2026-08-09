import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { user_id, password } = await request.json()

    if (!user_id || !password) {
      return NextResponse.json({ success: false, error: "User ID and password are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${user_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      },
      body: JSON.stringify({
        password_hash: hashedPassword,
      }),
    })

    if (!response.ok) {
      console.error("Failed to update password")
      return NextResponse.json({ success: false, error: "Failed to update password" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update password error:", error)
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 })
  }
}

