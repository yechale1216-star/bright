import { redirect } from 'next/navigation'

export default function ReportsPage() {
  redirect('/school/admin/attendance?tab=reports')
}
