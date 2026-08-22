import z from "zod"

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain uppercase")
    .regex(/[0-9]/, "Password must contain numbers"),
  full_name: z.string().min(2, "Full name required"),
  school_id: z.union([z.string(), z.number()]).optional().default("single-school"),
  role: z.enum(["admin", "teacher", "staff"]),
})

export const teacherSchema = z.object({
  full_name: z.string().min(2, "Teacher name required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")), // Added password field for teacher account creation
  phone: z.string().optional().or(z.literal("")),
  subject: z.string().optional().or(z.literal("")),
  qualification: z.string().optional().or(z.literal("")),
  experience_years: z.number().optional().or(z.literal("")),
  school_id: z.union([z.string(), z.number()]).transform((val) => String(val)).optional().default("single-school"),
})

// Student validation schemas
export const studentSchema = z.object({
  name: z.string().min(2, "Name required"),
  student_id: z.string().min(1, "Student ID required"),
  grade: z.string().min(1, "Grade required"),
  stream: z.string().optional().or(z.literal("")),
  section: z.string().min(1, "Section required"),
  parent_email: z.string().email("Invalid parent email").optional().or(z.literal("")),
  parent_phone: z.string().optional().or(z.literal("")),
  parent_name: z.string().optional().or(z.literal("")),
  school_id: z.union([z.string(), z.number()]).transform((val) => String(val)).optional().default("single-school"),
  gender: z.string().optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
})

// Attendance validation schemas
export const attendanceSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  class_id: z.string().uuid("Invalid class ID"),
  attendance_date: z.string().date("Invalid date"),
  status: z.enum(["present", "absent", "late", "excused"]),
  remarks: z.string().optional(),
  recorded_by: z.string().uuid("Invalid user ID"),
})

// Class validation schemas
export const classSchema = z.object({
  name: z.string().min(2, "Class name required"),
  grade: z.string().min(1, "Grade required"),
  section: z.string().min(1, "Section required"),
  school_id: z.union([z.string(), z.number()]).optional().default("single-school"),
  teacher_id: z.string().uuid("Invalid teacher ID").optional(),
})

export type LoginData = z.infer<typeof loginSchema>
export type RegisterData = z.infer<typeof registerSchema>
export type TeacherData = z.infer<typeof teacherSchema>
export type StudentData = z.infer<typeof studentSchema>
export type AttendanceData = z.infer<typeof attendanceSchema>
export type ClassData = z.infer<typeof classSchema>
