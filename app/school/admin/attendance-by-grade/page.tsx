import { redirect } from 'next/navigation'

export default function AttendanceByGradePage() {
  redirect('/school/admin/attendance?tab=analytics')
}
