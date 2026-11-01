import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const BUCKET_NAME = "student_profile"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  try {
    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  } catch (e) {
    console.warn("[student-photo] Failed to initialize Supabase admin client:", e)
    return null
  }
}

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

async function deleteOldPhoto(adminClient: any, oldUrl: string) {
  try {
    const marker = `/object/public/${BUCKET_NAME}/`
    const idx = oldUrl.indexOf(marker)
    if (idx === -1) return
    const filePath = decodeURIComponent(oldUrl.slice(idx + marker.length))
    await adminClient.storage.from(BUCKET_NAME).remove([filePath])
  } catch {
    console.warn("[student-photo] Failed to delete old photo:", oldUrl)
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminClient = getAdminClient()

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const oldUrl = formData.get("oldUrl") as string | null

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

    if (adminClient) {
      try {
        await ensureBucket(adminClient)

        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const randomId = Math.random().toString(36).substring(2, 11)
        const filePath = `student-photos/${Date.now()}-${randomId}.${ext}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)

        const { error: uploadError } = await adminClient.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false,
            cacheControl: "3600",
          })

        if (!uploadError) {
          const { data: urlData } = adminClient.storage.from(BUCKET_NAME).getPublicUrl(filePath)
          const publicUrl = urlData.publicUrl

          if (oldUrl && typeof oldUrl === "string" && oldUrl.startsWith("http")) {
            deleteOldPhoto(adminClient, oldUrl)
          }

          return NextResponse.json({ url: publicUrl }, { status: 200 })
        }
        console.warn("[student-photo] Supabase upload failed, falling back to data URL:", uploadError.message)
      } catch (storageErr) {
        console.warn("[student-photo] Supabase bucket operation failed, falling back to data URL:", storageErr)
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64String = Buffer.from(arrayBuffer).toString("base64")
    const mimeType = file.type || "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64String}`

    return NextResponse.json({ url: dataUrl }, { status: 200 })
  } catch (error: any) {
    console.error("[student-photo] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during upload." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminClient = getAdminClient()
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 })
    }

    if (adminClient) {
      await deleteOldPhoto(adminClient, url)
    }
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error("[student-photo] Delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete photo." },
      { status: 500 }
    )
  }
}

