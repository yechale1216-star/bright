import { DisciplineManagement } from '@/components/school/discipline/discipline-management';

export default function DisciplineOfficerCategoriesPage() {
  return (
    <div className="p-4 md:p-8">
      <DisciplineManagement userRole="discipline_officer" initialTab="categories" />
    </div>
  );
}
