'use client'

import { AdminDashboard } from '@/components/school/admin-dashboard'
import { useRouter } from 'next/navigation'

export default function SchoolAdminDashboard() {
  const router = useRouter()

  const handleNavigate = (tab: string) => {
    // Map old tab names to new App Router paths
    const tabToPath: Record<string, string> = {
      'dashboard': '/school/admin',
      'students': '/school/admin/students',
      'teachers': '/school/admin/teachers',
      'teacher-assignments': '/school/admin/teacher-assignments',
      'attendance': '/school/admin/attendance',
      'reports': '/school/admin/reports',
      'settings': '/school/admin/settings',
      'attendance-by-grade': '/school/admin/attendance-by-grade',
      'users-and-roles': '/school/admin/users-and-roles',
      'academic-years': '/school/admin/academic-years',
      'discipline': '/school/admin/discipline',
    }

    const path = tabToPath[tab]
    if (path) {
      router.push(path)
    } else {
      console.warn(`Unknown tab route: ${tab}`)
    }
  }

  return (
    <div className="p-4 md:p-8">
      <AdminDashboard onNavigate={handleNavigate} />
    </div>
  )
}

