import { StudentManagement } from '@/components/school/student-management'
import { AuthGuard } from '@/components/auth/auth-guard'

export default function StudentsPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'registrar']}>
    <div className="p-4 md:p-8">
      <StudentManagement />
    </div>
    </AuthGuard>
  )
}
