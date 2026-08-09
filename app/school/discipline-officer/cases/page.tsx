import { DisciplineManagement } from '@/components/school/discipline/discipline-management';

export default function DisciplineOfficerCasesPage() {
  return (
    <div className="p-4 md:p-8">
      <DisciplineManagement userRole="discipline_officer" />
    </div>
  );
}


