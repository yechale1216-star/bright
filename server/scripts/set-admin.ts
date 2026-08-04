import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const prisma = new PrismaClient()

async function main() {
  const email = "abinet21x@gmail.com"
  const rawPassword = "q12345678"
  const passwordHash = await bcrypt.hash(rawPassword, 10)
  const schoolName = "Addis Hiwot School"

  console.log(`[Seed] Setting up school admin account for ${email}...`)

  // 1. Ensure Default School exists
  let school = await prisma.school.findFirst({
    where: { name: schoolName }
  })

  if (!school) {
    school = await prisma.school.create({
      data: {
        name: schoolName,
        schoolId: "SCH-001",
        schoolEmail: email,
      }
    })
    console.log(`[Seed] Created school: ${school.name} (ID: ${school.id})`)
  } else {
    console.log(`[Seed] Found existing school: ${school.name} (ID: ${school.id})`)
  }

  // 2. Ensure School Settings exist
  const existingSettings = await prisma.schoolSettings.findUnique({
    where: { schoolId: school.id }
  })
  if (!existingSettings) {
    await prisma.schoolSettings.create({
      data: {
        schoolId: school.id,
        school_name: schoolName,
        academic_year: new Date().getFullYear().toString(),
        attendance_mode: "session_based",
        attendance_ui_type: "card_based",
        attendance_threshold: 75,
      }
    })
    console.log(`[Seed] Initialized school settings for school ${school.id}`)
  }

  // 3. Upsert School Admin User Account
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        password_hash: passwordHash,
        role: "admin",
        full_name: "Abinet Admin",
        schoolId: school.id,
        is_active: true,
        is_verified: true,
      }
    })
    console.log(`[Seed] Updated existing user ${updatedUser.email} as school admin (Role: admin)`)
  } else {
    const newUser = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        full_name: "Abinet Admin",
        role: "admin",
        schoolId: school.id,
        is_active: true,
        is_verified: true,
      }
    })
    console.log(`[Seed] Created new school admin user ${newUser.email} (ID: ${newUser.id})`)
  }

  console.log("\n✅ Account setup completed successfully!")
  console.log(`Email: ${email}`)
  console.log(`Password: ${rawPassword}`)
  console.log(`Role: admin`)
  console.log(`School: ${school.name}`)
}

main()
  .catch((e) => {
    console.error("Error setting up account:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
