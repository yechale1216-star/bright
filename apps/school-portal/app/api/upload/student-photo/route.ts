import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const BUCKET_NAME = "student_profile"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

/**
 * Returns a Supabase admin client using the service role key.
 * This client bypasses RLS and is only used server-side.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase configuration missing. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Ensures the student_profile bucket exists and is public.
 * Creates it if missing — safe to call on every upload.
 */
async function ensureBucket(adminClient: any) {
  const { data: bucket } = await adminClient.storage.getBucket(BUCKET_NAME)
  if (!bucket) {
    const { error } = await adminClient.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    })
    if (error && error.message !== "Bucket already exists") {
      throw new Error(`Failed to create storage bucket: ${error.message}`)
    }
  }
}

/**
 * Deletes a file from Supabase Storage given its full public URL.
 * Silently ignores errors (non-critical — old file cleanup).
 */
async function deleteOldPhoto(adminClient: any, oldUrl: string) {
  try {
    const marker = `/object/public/${BUCKET_NAME}/`
    const idx = oldUrl.indexOf(marker)
    if (idx === -1) return
    const filePath = decodeURIComponent(oldUrl.slice(idx + marker.length))
    await adminClient.storage.from(BUCKET_NAME).remove([filePath])
  } catch {
    // Non-fatal — log and continue
    console.warn("[student-photo] Failed to delete old photo:", oldUrl)
  }
}

/**
 * POST /api/upload/student-photo
 *
 * Accepts multipart/form-data with:
 *   - file: image file (JPG, PNG, WebP, max 5 MB)
 *   - oldUrl?: existing photo URL to delete after successful upload
 *
 * Returns: { url: string } — the public URL of the uploaded photo
 */
export async function POST(request: NextRequest) {
  try {
    const adminClient = getAdminClient()

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

    // — Ensure bucket exists —
    await ensureBucket(adminClient)

    // — Generate a unique file path —
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const randomId = Math.random().toString(36).substring(2, 11)
    const filePath = `student-photos/${Date.now()}-${randomId}.${ext}`

    // — Convert File to ArrayBuffer for upload —
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // — Upload to Supabase Storage —
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      })

    if (uploadError) {
      console.error("[student-photo] Upload error:", uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // — Get public URL —
    const { data: urlData } = adminClient.storage.from(BUCKET_NAME).getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    // — Delete old photo if provided (fire-and-forget) —
    if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith("http")) {
      deleteOldPhoto(adminClient, oldUrl)
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
 *
 * Accepts JSON body: { url: string }
 * Deletes the photo from Supabase Storage.
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminClient = getAdminClient()
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 })
    }

    await deleteOldPhoto(adminClient, url)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("[student-photo] Delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete photo." },
      { status: 500 }
    )
  }
}

