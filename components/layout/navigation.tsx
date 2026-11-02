"use client"
import { cn } from "@/lib/utils/utils"
import { authService } from "@/lib/auth/auth"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const user = authService.getCurrentUser()
  const isAdmin = authService.isAdmin()

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "students", label: "Student Management", icon: "👥" },
    ...(isAdmin ? [{ id: "teachers", label: "Teacher Management", icon: "👨‍🏫" }] : []),
    { id: "attendance", label: "Mark Attendance", icon: "✅" },
    { id: "reports", label: "Reports", icon: "📈" },
    ...(isAdmin
      ? [
          { id: "settings", label: "Settings", icon: "⚙️" },
        ]
      : []),
    { id: "profile", label: "Profile", icon: "👤" },
  ]

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              )}
            >
              <span className="typography-card-title">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
