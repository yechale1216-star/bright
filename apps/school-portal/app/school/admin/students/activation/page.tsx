import StudentActivationManager from '@/components/school/student-activation-manager'
import { AuthGuard } from '@/components/auth/auth-guard'

export default function StudentActivationPage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'registrar']}>
      <div className="p-4 md:p-8">
        <StudentActivationManager />
      </div>
    </AuthGuard>
  )
}
