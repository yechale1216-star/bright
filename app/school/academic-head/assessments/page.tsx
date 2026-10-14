'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function AcademicHeadAssessmentsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/school/academic-head/assessments/submissions')
  }, [router])

  return (
    <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 min-h-[40vh]">
      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
      Loading Assessments Workspace...
    </div>
  )
}
