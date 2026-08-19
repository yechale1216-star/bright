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
  Filter,
  Users,
  Globe
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { parentDatabase, ParentNotification } from "@/lib/db/parent-db"
import { useLanguage } from "@/lib/context/language-context"
import { formatLocalizedDate, formatLocalizedTime } from "@/lib/utils/date-utils"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { cn } from "@/lib/utils/utils"

export default function AnnouncementsPage() {
  const { t, language } = useLanguage()
  const [announcements, setAnnouncements] = useState<ParentNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [audienceFilter, setAudienceFilter] = useState<"ALL" | "PARENTS" | "GENERAL">("ALL")

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
          const filtered = list.filter(n => n.type === "announcement" || n.type === "emergency" || n.type === "info" || n.category === "ANNOUNCEMENT")
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
    
    if (!matchesSearch || !matchesFilter) return false

    if (audienceFilter === "ALL") return true
    const currentAud = (a.targetAudience || "GENERAL").toUpperCase()
    if (audienceFilter === "GENERAL") return currentAud === "GENERAL" || !a.targetAudience
    return currentAud === audienceFilter
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
      case "info": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
      default: return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
    }
  }

  const getAudienceBadge = (audience?: string) => {
    const aud = (audience || "GENERAL").toUpperCase()
    if (aud === "PARENTS") {
      return {
        label: "Parents Only",
        icon: Users,
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
      }
    }
    return {
      label: "General",
      icon: Globe,
      badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
    }
  }

  const parentsCount = announcements.filter(a => (a.targetAudience || "").toUpperCase() === "PARENTS").length
  const generalCount = announcements.filter(a => !a.targetAudience || (a.targetAudience || "").toUpperCase() === "GENERAL").length

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div className="space-y-1">
          <h1 className="typography-page-title text-foreground flex items-center gap-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
            <Megaphone className="w-7 h-7 text-emerald-600 shrink-0" />
            School Announcements
          </h1>
          <p className="typography-label text-muted-foreground text-xs sm:text-sm">
            Stay updated with official broadcasts, notices, and alerts from your school.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search announcements..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border/60 rounded-2xl h-11 shadow-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={filterType === "all" ? "default" : "outline"} 
              onClick={() => setFilterType("all")}
              className="rounded-xl h-11 px-5 font-semibold text-xs"
            >
              All
            </Button>
            <Button 
              variant={filterType === "emergency" ? "destructive" : "outline"}
              onClick={() => setFilterType("emergency")}
              className="rounded-xl h-11 px-5 font-semibold text-xs"
            >
              Alerts
            </Button>
          </div>
        </div>

        {/* Audience filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: "ALL", label: "All Broadcasts", icon: Filter, count: announcements.length },
            { id: "PARENTS", label: "Parents Only", icon: Users, count: parentsCount },
            { id: "GENERAL", label: "General (Everyone)", icon: Globe, count: generalCount },
          ].map(tab => {
            const isActive = audienceFilter === tab.id
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setAudienceFilter(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer",
                  isActive
                    ? "bg-primary text-white shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted"
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isActive ? "bg-white/25 text-white" : "bg-background text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
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
                <p className="text-muted-foreground text-xs">
                  {searchTerm ? "No results match your search." : "Check back later for school updates and newsletters."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredList.map((item) => {
            const audBadge = getAudienceBadge(item.targetAudience)
            const AudIcon = audBadge.icon

            return (
              <Card 
                key={item.id} 
                className={cn(
                  "border-border/60 shadow-xs rounded-3xl overflow-hidden transition-all hover:shadow-md hover:border-border",
                  item.type === 'emergency' && 'border-rose-500/30'
                )}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Left accent bar */}
                    <div className={cn(
                      "w-full sm:w-2 shrink-0",
                      item.type === 'emergency' ? 'bg-rose-500' : 'bg-emerald-500'
                    )} />
                    
                    <div className="p-5 sm:p-6 flex-1 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2.5 rounded-xl shrink-0", getTypeStyles(item.type))}>
                            {getTypeIcon(item.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <h3 className="font-bold text-base sm:text-lg text-foreground">
                                {item.title}
                              </h3>
                              <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold flex items-center gap-1", audBadge.badgeClass)}>
                                <AudIcon className="w-3 h-3" />
                                <span>{audBadge.label}</span>
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {formatLocalizedDate(item.createdAt, language, { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {formatLocalizedTime(item.createdAt, language)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Badge className={cn("rounded-lg px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider self-start sm:self-center border-none", getTypeStyles(item.type))}>
                          {item.type}
                        </Badge>
                      </div>

                      <div className="bg-muted/40 p-4 sm:p-5 rounded-2xl border border-border/40">
                        <p className="text-foreground/90 leading-relaxed text-xs sm:text-sm whitespace-pre-wrap">
                          {item.message}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-widest">
                          School Broadcast
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => parentDatabase.markNotificationAsRead(item.id)}
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl gap-1 text-xs font-bold"
                        >
                          Mark as Read
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
