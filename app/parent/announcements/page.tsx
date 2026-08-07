"use client"

import { useState, useEffect } from "react"
import { 
  Megaphone, 
  Search, 
  Clock, 
  Bell, 
  AlertTriangle,
  Info,
  Calendar,
  ChevronRight,
  Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { parentDatabase, ParentNotification } from "@/lib/db/parent-db"
import { useLanguage } from "@/lib/context/language-context"
import { formatLocalizedDate, formatLocalizedTime } from "@/lib/utils/date-utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function AnnouncementsPage() {
  const { t, language } = useLanguage()
  const [announcements, setAnnouncements] = useState<ParentNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true)
      try {
        const userStr = localStorage.getItem("attendance_current_user") || localStorage.getItem("auth_user") || sessionStorage.getItem("auth_user")
        if (userStr) {
          const user = JSON.parse(userStr)
          const phone = user.phone || user.phoneNumber || ""
          const list = await parentDatabase.getNotifications(phone)
          // Filter to only show announcements and emergencies (or ANNOUNCEMENT category)
          const filtered = list.filter(n => n.type === "announcement" || n.type === "emergency" || n.category === "ANNOUNCEMENT")
          setAnnouncements(filtered)
        }
      } catch (error) {
        console.error("Failed to fetch announcements:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAll()
  }, [])

  const filteredList = announcements.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.message.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === "all" || a.type === filterType
    return matchesSearch && matchesFilter
  })

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "emergency": return <AlertTriangle className="w-5 h-5 text-rose-500" />
      case "announcement": return <Megaphone className="w-5 h-5 text-emerald-500" />
      default: return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getTypeStyles = (type: string) => {
    switch(type) {
      case "emergency": return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800"
      default: return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1">
          <h1 className="typography-page-title text-foreground flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-emerald-600" />
            School Announcements
          </h1>
          <p className="typography-label text-muted-foreground">
            Stay updated with the latest news, events, and important notices from your school.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search announcements..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/50 dark:bg-slate-900/50 border-border/40 rounded-2xl h-12"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filterType === "all" ? "default" : "outline"} 
            onClick={() => setFilterType("all")}
            className="rounded-xl h-12 px-6"
          >
            All
          </Button>
          <Button 
            variant={filterType === "emergency" ? "destructive" : "outline"}
            onClick={() => setFilterType("emergency")}
            className="rounded-xl h-12 px-6"
          >
            Alerts
          </Button>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-6">
        {isLoading ? (
          <PageSkeleton variant="cards" />
        ) : filteredList.length === 0 ? (
          <Card className="border-border/40 shadow-none bg-muted/5 rounded-3xl border-dashed py-20 text-center">
            <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted/20 rounded-full">
                <Bell className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <div>
                <h3 className="font-bold text-lg">No announcements found</h3>
                <p className="text-muted-foreground">Check back later for school updates and newsletters.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredList.map((item) => (
            <Card 
              key={item.id} 
              className={`border-border/40 shadow-lg rounded-3xl overflow-hidden transition-all hover:scale-[1.01] ${
                item.type === 'emergency' ? 'border-rose-500/20' : ''
              }`}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* Left accent bar for importance */}
                  <div className={`w-full sm:w-2 ${item.type === 'emergency' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${getTypeStyles(item.type)}`}>
                          {getTypeIcon(item.type)}
                        </div>
                        <div>
                          <h3 className="font-bold text-xl text-foreground group-hover:text-emerald-600 transition-colors">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="typography-label text-muted-foreground flex items-center gap-1.5 text-xs">
                              <Calendar className="w-3 h-3" />
                              {formatLocalizedDate(item.createdAt, language, { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                            <span className="typography-label text-muted-foreground flex items-center gap-1.5 text-xs">
                              <Clock className="w-3 h-3" />
                              {formatLocalizedTime(item.createdAt, language)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`rounded-lg px-3 py-1 text-[10px] uppercase font-bold tracking-wider ${getTypeStyles(item.type)} border-none`}>
                        {item.type}
                      </Badge>
                    </div>

                    <div className="bg-muted/30 p-5 rounded-2xl border border-border/10">
                      <p className="text-foreground/80 leading-relaxed text-sm whitespace-pre-wrap italic">
                        "{item.message}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                       <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                         Published by School Admin
                       </span>
                       <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg gap-2 text-xs font-bold uppercase">
                         Mark as Read
                         <ChevronRight className="w-4 h-4" />
                       </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
