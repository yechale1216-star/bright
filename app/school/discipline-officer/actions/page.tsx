import { DisciplineManagement } from '@/components/school/discipline/discipline-management';

export default function DisciplineOfficerActionsPage() {
  return (
    <div className="p-4 md:p-8">
      <DisciplineManagement userRole="discipline_officer" initialTab="actions" />
    </div>
  );
}
