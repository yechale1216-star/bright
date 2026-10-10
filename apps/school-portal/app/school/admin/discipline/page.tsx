import { DisciplineManagement } from '@/components/school/discipline/discipline-management';

export default function AdminDisciplinePage() {
  return (
    <div className="p-4 md:p-8">
      <DisciplineManagement userRole="school_admin" />
    </div>
  );
}
