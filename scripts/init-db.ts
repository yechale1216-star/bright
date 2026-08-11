import fetch from "node-fetch"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const initSql = `
-- Drop existing objects
DROP POLICY IF EXISTS "Users can view their own school" ON schools;
DROP POLICY IF EXISTS "Users can view school members" ON users;
DROP POLICY IF EXISTS "Users can view classes in their school" ON classes;
DROP POLICY IF EXISTS "Users can view students in their school" ON students;
DROP POLICY IF EXISTS "Users can view attendance in their school" ON attendance;
DROP POLICY IF EXISTS "Users can insert attendance in their school" ON attendance;
DROP POLICY IF EXISTS "Users can view reports in their school" ON attendance_reports;
DROP POLICY IF EXISTS "Users can view email settings for their school" ON email_settings;
DROP POLICY IF EXISTS "Only admins can update email settings" ON email_settings;
DROP INDEX IF EXISTS idx_users_school_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_classes_school_id;
DROP INDEX IF EXISTS idx_students_school_id;
DROP INDEX IF EXISTS idx_students_class_id;
DROP INDEX IF EXISTS idx_attendance_school_id;
DROP INDEX IF EXISTS idx_attendance_student_id;
DROP INDEX IF EXISTS idx_attendance_date;
DROP INDEX IF EXISTS idx_attendance_class_id;
DROP INDEX IF EXISTS idx_reports_school_id;
DROP INDEX IF EXISTS idx_reports_student_id;
DROP TABLE IF EXISTS email_settings CASCADE;
DROP TABLE IF EXISTS attendance_reports CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS schools CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'teacher',
  school_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create schools table
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  admin_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key to users
ALTER TABLE users ADD CONSTRAINT fk_users_school FOREIGN KEY (school_id) REFERENCES schools(id);

-- Create classes table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  grade VARCHAR(50),
  section VARCHAR(50),
  class_teacher_id UUID REFERENCES users(id),
  capacity INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, name, grade, section)
);

-- Create students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  roll_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  date_of_birth DATE,
  gender VARCHAR(10),
  parent_name VARCHAR(255),
  parent_phone VARCHAR(20),
  parent_email VARCHAR(255),
  address TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, class_id, roll_number)
);

-- Create attendance table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  remarks TEXT,
  marked_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, student_id, attendance_date)
);

-- Create attendance reports table
CREATE TABLE attendance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_days INTEGER,
  present_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  leave_days INTEGER DEFAULT 0,
  late_days INTEGER DEFAULT 0,
  attendance_percentage DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, student_id, month, year)
);

-- Create email settings table
CREATE TABLE email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  smtp_user VARCHAR(255),
  smtp_password VARCHAR(255),
  from_email VARCHAR(255),
  send_daily_reports BOOLEAN DEFAULT false,
  send_weekly_reports BOOLEAN DEFAULT false,
  low_attendance_threshold INTEGER DEFAULT 75,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id)
);

-- Create indexes
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_attendance_school_id ON attendance(school_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_class_id ON attendance(class_id);
CREATE INDEX idx_reports_school_id ON attendance_reports(school_id);
CREATE INDEX idx_reports_student_id ON attendance_reports(student_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own school"
  ON schools FOR SELECT
  USING (auth.uid()::uuid = admin_id);

CREATE POLICY "Users can view school members"
  ON users FOR SELECT
  USING (school_id IS NOT NULL);

CREATE POLICY "Users can view classes in their school"
  ON classes FOR SELECT
  USING (true);

CREATE POLICY "Users can view students in their school"
  ON students FOR SELECT
  USING (true);

CREATE POLICY "Users can view attendance in their school"
  ON attendance FOR SELECT
  USING (true);

CREATE POLICY "Users can insert attendance in their school"
  ON attendance FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view reports in their school"
  ON attendance_reports FOR SELECT
  USING (true);

CREATE POLICY "Users can view email settings for their school"
  ON email_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update email settings"
  ON email_settings FOR UPDATE
  USING (true);
`

async function initDatabase() {
  try {
    console.log("Starting database initialization...")

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey as string,
      },
      body: JSON.stringify({ sql: initSql }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    console.log("Database initialized successfully!")
  } catch (error) {
    console.error("Error during initialization:", error)
    process.exit(1)
  }
}

initDatabase()
