'use client'

import { AuthWrapper } from '@/components/auth/auth-wrapper'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/auth/auth'
import { Suspense } from 'react'

function LoginContent() {
  const router = useRouter()

  const handleAuthSuccess = (userData?: any) => {
    // 1. Capture current state
    const user = userData || authService.getCurrentUser()
    const role = user?.role || 'parent';
    
    // Get schools from userData first, then fallback to localStorage
    let schools = userData?._availableSchools;
    if (!schools) {
      const availableStr = localStorage.getItem("available_schools")
      schools = availableStr ? JSON.parse(availableStr) : []
    }
    
    console.log(`[LoginPage] handleAuthSuccess | role: ${role} | schools: ${schools?.length || 0}`)
    
    // 2. Perform redirection with a tiny delay to let AuthContext settle
    setTimeout(() => {
      if (role === 'admin' || role === 'school_admin' || role === 'school-admin') {
        router.push('/school/admin')
      } else if (role === 'teacher') {
        router.push('/school/teacher')
      } else if (role === 'staff' || role === 'staff_member') {
        router.push('/school/staff')
      } else if (role === 'registrar') {
        router.push('/school/registrar')
      } else if (role === 'discipline_officer') {
        router.push('/school/discipline-officer')
      } else if (role === 'parent') {
        router.push('/parent/dashboard')
      } else {
        router.push('/school/staff')
      }
    }, 50)
  }

  return (
    <AuthWrapper onAuthSuccess={handleAuthSuccess} defaultView="login" />
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}


