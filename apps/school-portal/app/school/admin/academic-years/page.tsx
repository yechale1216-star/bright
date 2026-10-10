'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'

export default function AcademicYearsRedirectPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/school/admin/settings')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="md" className="text-primary" />
    </div>
  )
}
