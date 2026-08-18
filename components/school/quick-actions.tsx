"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { authService } from "@/lib/auth/auth"
import { db } from "@/lib/db/database"
import { notifications } from "@/lib/utils/notifications"
import { ClipboardCheck, BarChart3, UserCog } from "lucide-react"

interface QuickActionsProps {
  onNavigate: (tab: string) => void
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    setIsAdmin(authService.isAdmin())
    setUser(authService.getCurrentUser())
  }, [])

  const handleQuickAttendance = async () => {
    setIsLoading(true)
    try {
      onNavigate("attendance")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    onNavigate("reports")
  }

  const teacherActions = [
    {
      title: "Take Attendance",
      description: "Quickly navigate to attendance tracking",
      action: handleQuickAttendance,
      icon: <ClipboardCheck className="w-6 h-6 text-blue-600 dark:text-blue-500" />,
      color: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",
    },
    {
      title: "Weekly Report",
      description: "Generate last 7 days attendance report",
      action: handleGenerateReport,
      icon: <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-500" />,
      color: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30",
    },
  ]

  const adminActions = [
    ...teacherActions,
    {
      title: "Manage Teachers",
      description: "Assign teachers to classes and subjects",
      action: () => onNavigate("assignments"),
      icon: <UserCog className="w-6 h-6 text-green-600 dark:text-green-500" />,
      color: "bg-green-500/10 hover:bg-green-500/20 border-green-500/30",
    },
  ]

  const actions = isAdmin ? adminActions : teacherActions

  return (
    <Card className="border-none shadow-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action, index) => (
            <div 
              key={index} 
              onClick={action.action}
              className={`group relative cursor-pointer p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg active:scale-[0.98] ${action.color} backdrop-blur-sm`}
            >
              <div className="flex items-start gap-4">
                <div className="typography-section-title h-12 w-12 rounded-xl bg-white/80 dark:bg-slate-900/80 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="typography-label text-foreground mb-1">
                    {action.title}
                  </h3>
                  <p className="typography-helper text-muted-foreground line-clamp-2">
                    {action.description}
                  </p>
                </div>
              </div>
              
              <div className="typography-label mt-4 flex items-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Execute Action 
                <span className="typography-card-title ml-1">→</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}



