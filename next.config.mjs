/** @type {import('next').NextConfig} */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const nextConfig = {
  typescript: {
    // API routes use force-dynamic which is incompatible with static export,
    // but those routes run on the remote server — not inside the APK WebView.
    // Safe to ignore during the Capacitor build.
    ignoreBuildErrors: isCapacitorBuild ? true : false,
  },
  // ESLint key removed — no longer supported in Next.js 16
  output: isCapacitorBuild ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  turbopack: {},
  async redirects() {
    if (isCapacitorBuild) return [];
    return [
      // Academic Structure aliases
      { source: '/school/admin/academic_structure', destination: '/school/admin/academic-structure', permanent: false },
      { source: '/school/admin/academics', destination: '/school/admin/academic-structure', permanent: false },
      { source: '/school/admin/academic', destination: '/school/admin/academic-structure', permanent: false },
      { source: '/school/academic-structure', destination: '/school/admin/academic-structure', permanent: false },
      { source: '/academic-structure', destination: '/school/admin/academic-structure', permanent: false },

      // Exams & Grades aliases
      { source: '/school/admin/exams-and-grades', destination: '/school/admin/exams', permanent: false },
      { source: '/school/admin/exam-and-grades', destination: '/school/admin/exams', permanent: false },
      { source: '/school/admin/exam-and-grade', destination: '/school/admin/exams', permanent: false },
      { source: '/school/admin/exams-and-grade', destination: '/school/admin/exams', permanent: false },
      { source: '/school/admin/exam', destination: '/school/admin/exams', permanent: false },
      { source: '/school/admin/grades', destination: '/school/admin/exams', permanent: false },
      { source: '/school/admin/grade', destination: '/school/admin/exams', permanent: false },
      { source: '/school/exams', destination: '/school/admin/exams', permanent: false },
      { source: '/exams', destination: '/school/admin/exams', permanent: false },

      // Transport aliases & typos
      { source: '/school/admin/transporet', destination: '/school/admin/transport', permanent: false },
      { source: '/school/admin/transportation', destination: '/school/admin/transport', permanent: false },
      { source: '/school/transport', destination: '/school/admin/transport', permanent: false },
      { source: '/school/transporet', destination: '/school/admin/transport', permanent: false },
      { source: '/transport', destination: '/school/admin/transport', permanent: false },
      { source: '/transporet', destination: '/school/admin/transport', permanent: false },

      // Library aliases
      { source: '/school/library', destination: '/school/admin/library', permanent: false },
      { source: '/library', destination: '/school/admin/library', permanent: false },

      // Report Cards aliases
      { source: '/school/admin/report-card', destination: '/school/admin/report-cards', permanent: false },
      { source: '/school/admin/reportcards', destination: '/school/admin/report-cards', permanent: false },
      { source: '/school/admin/reportcard', destination: '/school/admin/report-cards', permanent: false },
      { source: '/school/report-cards', destination: '/school/admin/report-cards', permanent: false },
      { source: '/report-cards', destination: '/school/admin/report-cards', permanent: false },

      // Teacher Gradebook aliases
      { source: '/school/teacher/grade-book', destination: '/school/teacher/gradebook', permanent: false },
      { source: '/school/teacher/grades', destination: '/school/teacher/gradebook', permanent: false },
      { source: '/school/teacher/grade', destination: '/school/teacher/gradebook', permanent: false },
      { source: '/teacher/gradebook', destination: '/school/teacher/gradebook', permanent: false },
      { source: '/teacher/grade-book', destination: '/school/teacher/gradebook', permanent: false },
      { source: '/gradebook', destination: '/school/teacher/gradebook', permanent: false },
      { source: '/grade-book', destination: '/school/teacher/gradebook', permanent: false },

      // Teacher & Parent Homework aliases
      { source: '/school/teacher/home-work', destination: '/school/teacher/homework', permanent: false },
      { source: '/teacher/homework', destination: '/school/teacher/homework', permanent: false },
      { source: '/teacher/home-work', destination: '/school/teacher/homework', permanent: false },
      { source: '/homework', destination: '/school/teacher/homework', permanent: false },
      { source: '/home-work', destination: '/school/teacher/homework', permanent: false },
      { source: '/parent/home-work', destination: '/parent/homework', permanent: false },
      { source: '/student/home-work', destination: '/student/homework', permanent: false },

      // Teacher Materials & Attendance aliases
      { source: '/school/teacher/material', destination: '/school/teacher/materials', permanent: false },
      { source: '/teacher/materials', destination: '/school/teacher/materials', permanent: false },
      { source: '/teacher/material', destination: '/school/teacher/materials', permanent: false },
      { source: '/materials', destination: '/school/teacher/materials', permanent: false },
      { source: '/teacher/attendance', destination: '/school/teacher/attendance', permanent: false },
      { source: '/teacher/classes', destination: '/school/teacher/classes', permanent: false },
      { source: '/teacher/reports', destination: '/school/teacher/reports', permanent: false },
      { source: '/teacher/profile', destination: '/school/teacher/profile', permanent: false },
      { source: '/teacher', destination: '/school/teacher', permanent: false },

      // Admin generic shortcuts
      { source: '/admin/students', destination: '/school/admin/students', permanent: false },
      { source: '/admin/teachers', destination: '/school/admin/teachers', permanent: false },
      { source: '/admin/attendance', destination: '/school/admin/attendance', permanent: false },
      { source: '/admin/settings', destination: '/school/admin/settings', permanent: false },
      { source: '/admin', destination: '/school/admin', permanent: false },
      { source: '/school/admin/academic_years', destination: '/school/admin/academic-years', permanent: false },
      { source: '/school/admin/teacher-assignment', destination: '/school/admin/teacher-assignments', permanent: false },
      { source: '/school/admin/teacher_assignments', destination: '/school/admin/teacher-assignments', permanent: false },
      { source: '/school/admin/user-and-roles', destination: '/school/admin/users-and-roles', permanent: false },
      { source: '/school/admin/users_and_roles', destination: '/school/admin/users-and-roles', permanent: false },
      { source: '/school/admin/staff_attendance', destination: '/school/admin/staff-attendance', permanent: false },

      // Parent & Student shortcuts
      { source: '/parent/transporet', destination: '/parent/transport', permanent: false },
      { source: '/parent/transportation', destination: '/parent/transport', permanent: false },
      { source: '/parent/material', destination: '/parent/materials', permanent: false },
      { source: '/student/grades', destination: '/student/marks', permanent: false },
      { source: '/student/grade', destination: '/student/marks', permanent: false },
      { source: '/student/exam', destination: '/student/marks', permanent: false },
      { source: '/student/exams', destination: '/student/marks', permanent: false },
    ];
  },
  async rewrites() {
    if (isCapacitorBuild) return [];
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
}

export default nextConfig
