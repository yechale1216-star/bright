import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const BUCKET_NAME = "avatars"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

/**
 * Returns a Supabase client for storage operations.
 * Uses service role key when available, falling back to anon key.
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      "Supabase configuration missing. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Non-blocking bucket check.
 * The 'avatars' bucket is pre-existing and shared with teacher/staff photos.
 */
async function ensureBucket(client: any) {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: bucket } = await client.storage.getBucket(BUCKET_NAME)
      if (!bucket) {
        await client.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_TYPES,
        })
      }
    }
  } catch (err) {
    console.warn("[student-photo] ensureBucket notice (non-fatal):", err)
  }
}

/**
 * Deletes an old photo from Supabase Storage given its public URL.
 */
async function deleteOldPhoto(client: any, oldUrl: string) {
  try {
    const marker = `/object/public/${BUCKET_NAME}/`
    const idx = oldUrl.indexOf(marker)
    if (idx === -1) return
    const filePath = decodeURIComponent(oldUrl.slice(idx + marker.length))
    // Only delete files under the students/ prefix to protect teacher/admin avatars
    if (filePath.startsWith("students/")) {
      await client.storage.from(BUCKET_NAME).remove([filePath])
    }
  } catch {
    console.warn("[student-photo] Failed to delete old photo (non-fatal):", oldUrl)
  }
}

/**
 * POST /api/upload/student-photo
 * Accepts multipart/form-data with 'file' and optional 'oldUrl'.
 * Returns: { url: string } with immutable CDN cache headers.
 */
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient()

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const oldUrl = formData.get("oldUrl") as string | null

    // — Validation —
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, and WebP images are accepted." },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 400 }
      )
    }

    await ensureBucket(client)

    // Generate unique storage path under students/
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const randomId = Math.random().toString(36).substring(2, 11)
    const filePath = `students/student-${Date.now()}-${randomId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload with 1-year immutable cache header for instant subsequent loads
    const { error: uploadError } = await client.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
        cacheControl: "31536000, immutable",
      })

    if (uploadError) {
      console.error("[student-photo] Upload error:", uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: urlData } = client.storage.from(BUCKET_NAME).getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    // Clean up replaced photo in background
    if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith("http")) {
      deleteOldPhoto(client, oldUrl)
    }

    return NextResponse.json({ url: publicUrl }, { status: 200 })
  } catch (error: any) {
    console.error("[student-photo] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during upload." },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/upload/student-photo
 */
export async function DELETE(request: NextRequest) {
  try {
    const client = getSupabaseClient()
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 })
    }

    await deleteOldPhoto(client, url)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("[student-photo] Delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete photo." },
      { status: 500 }
    )
  }
}
