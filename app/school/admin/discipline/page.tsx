import { DisciplineManagement } from '@/components/school/discipline/discipline-management';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function AdminDisciplinePage() {
  return (
    <AuthGuard allowedRoles={['admin', 'school_admin', 'super_admin', 'discipline_officer']}>
    <div className="p-4 md:p-8">
      <DisciplineManagement userRole="school_admin" />
    </div>
    </AuthGuard>
  );
}
