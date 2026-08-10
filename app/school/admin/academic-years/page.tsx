'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AcademicYearsRedirectPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/school/admin/settings')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-500">Redirecting to Settings...</span>
      </div>
    </div>
  )
}
