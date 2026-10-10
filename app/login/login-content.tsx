'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthWrapper } from '@/components/auth/auth-wrapper'
import { authService } from '@/lib/auth/auth'
import { authStorage } from '@/lib/auth/auth-storage'
import { useAuth } from '@/lib/context/auth-context'
import { Spinner } from '@/components/ui/spinner'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, sessionReady } = useAuth()

  const handleAuthSuccess = (userData?: any) => {
    const user = userData || authUser || authService.getCurrentUser()
    const role = (user?.role || 'parent').toLowerCase()

    let schools = userData?._availableSchools
    if (!schools) {
      const availableStr = typeof window !== 'undefined' ? localStorage.getItem("available_schools") : null
      schools = availableStr ? JSON.parse(availableStr) : []
    }

    console.log(`[LoginPage] handleAuthSuccess | role: ${role} | schools: ${schools?.length || 0}`)

    setTimeout(() => {
      if (role === 'admin' || role === 'school_admin' || role === 'school-admin' || role === 'super_admin') {
        router.replace('/school/admin')
      } else if (role === 'teacher') {
        router.replace('/school/teacher')
      } else if (role === 'registrar') {
        router.replace('/school/registrar')
      } else if (role === 'discipline_officer') {
        router.replace('/school/discipline-officer')
      } else if (role === 'parent') {
        router.replace('/parent/dashboard')
      } else if (role === 'student') {
        router.replace('/student')
      } else {
        router.replace('/school/staff')
      }
    }, 50)
  }

  // If user is already authenticated and not directed here due to session expiration,
  // automatically forward to their role dashboard
  useEffect(() => {
    if (searchParams.get("reason") === "expired") return

    const token = authStorage.getToken()
    const user = authUser || authStorage.getUser()

    if (token && user) {
      console.log(`[LoginPage] User already authenticated (${user.role}). Redirecting to dashboard...`)
      handleAuthSuccess(user)
    }
  }, [authUser, searchParams])

  return (
    <AuthWrapper onAuthSuccess={handleAuthSuccess} defaultView="login" />
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
