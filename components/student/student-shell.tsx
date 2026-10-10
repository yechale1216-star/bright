"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookOpen,
  Award,
  CalendarCheck,
  CalendarDays,
  Megaphone,
  ShieldAlert,
  FolderDown,
  User,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Sparkles,
  ChevronRight,
  Clock,
  Layers,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { studentDb } from "@/lib/db/student-db";
import { cn } from "@/lib/utils/utils";

interface StudentShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { name: "Home", href: "/student", icon: Home },
  { name: "My Classes", href: "/student/classes", icon: Layers },
  { name: "Homework", href: "/student/homework", icon: BookOpen },
  { name: "Marks / Results", href: "/student/marks", icon: Award },
  { name: "Attendance", href: "/student/attendance", icon: CalendarCheck },
  { name: "Timetable", href: "/student/timetable", icon: CalendarDays },
  { name: "Announcements", href: "/student/announcements", icon: Megaphone },
  { name: "Discipline", href: "/student/discipline", icon: ShieldAlert },
  { name: "Learning Materials", href: "/student/materials", icon: FolderDown },
  { name: "Profile", href: "/student/profile", icon: User },
];

export function StudentShell({ children }: StudentShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [student, setStudent] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    // Read cached student or fetch profile
    const readSession = () => {
      try {
        const stored = localStorage.getItem("attendance_current_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.role === "student") {
            setStudent(parsed);
          }
        }
      } catch {}
    };

    readSession();
    window.addEventListener("userSessionChanged", readSession);

    // Initial fetch from backend to ensure active enrollment/name is fresh
    studentDb.getDashboard().then((res) => {
      if (res?.student) {
        setStudent((prev: any) => ({
          ...prev,
          name: res.student.name || prev?.name,
          studentCode: res.student.student_id || prev?.studentCode,
          grade: res.student.grade || prev?.grade,
          section: res.student.section || prev?.section,
          stream: res.student.stream || prev?.stream,
          photo: res.student.photo || prev?.photo,
        }));
      }
    }).catch(() => {});

    // Clock update
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 30000);

    return () => {
      window.removeEventListener("userSessionChanged", readSession);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("attendance_token");
    localStorage.removeItem("attendance_current_user");
    window.dispatchEvent(new Event("userSessionChanged"));
    router.replace("/student/login");
  };

  const displayName = student?.name || "Amanuel Tesfaye";
  const displayGrade = student?.grade ? `Grade ${student.grade}` : "Grade 12";
  const displayStream = student?.stream ? ` • ${student.stream}` : " • Natural";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row antialiased selection:bg-purple-500 selection:text-white">
      {/* ─── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1e1b4b] text-white shrink-0 shadow-xl border-r border-indigo-950/40 z-30 justify-between">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 pb-5 border-b border-indigo-900/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/30 ring-2 ring-purple-400/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide leading-tight text-white flex items-center gap-1.5">
                Bright Path
              </h1>
              <p className="text-xs text-purple-300 font-medium">Student Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/student"
                  ? pathname === "/student"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group",
                    isActive
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-indigo-200/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-purple-300/80"
                    )}
                  />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Branding & Logout */}
        <div className="p-4 border-t border-indigo-900/40 space-y-3">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-indigo-300 hover:text-white hover:bg-white/10 text-xs font-medium rounded-xl h-9 px-3"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </Button>

          <div className="px-2 pt-1 text-[11px] text-indigo-300/70 leading-relaxed">
            <p className="font-semibold text-indigo-200">Student Portal</p>
            <p>Bright Path • Powered by Ethio Nova</p>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Header ────────────────────────────────────────────────── */}
      <header className="md:hidden bg-[#1e1b4b] text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-none">Bright Path</h1>
            <p className="text-[10px] text-purple-300">Student Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/student/profile" className="flex items-center gap-2">
            <Avatar className="w-8 h-8 ring-2 ring-purple-500/30">
              <AvatarImage src={student?.photo || ""} />
              <AvatarFallback className="bg-purple-700 text-white text-xs font-semibold">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white hover:bg-white/10"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex">
          <div className="w-72 bg-[#1e1b4b] text-white h-full flex flex-col justify-between p-4 shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-indigo-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm">Bright Path</h2>
                    <p className="text-xs text-purple-300">Student Portal</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Student info summary */}
              <div className="my-4 p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                <Avatar className="w-10 h-10 ring-2 ring-purple-400/40">
                  <AvatarFallback className="bg-purple-700 text-white text-xs font-bold">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-xs text-white">{displayName}</p>
                  <p className="text-[11px] text-purple-300">
                    {displayGrade} {displayStream}
                  </p>
                </div>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/student"
                      ? pathname === "/student"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-colors",
                        isActive
                          ? "bg-purple-600 text-white font-semibold"
                          : "text-indigo-200/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-indigo-900/40">
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full bg-red-600/80 hover:bg-red-600 text-white text-xs h-9 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>

          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* ─── Main Content Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar (Desktop & Tablet) */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
          {/* Search bar */}
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search classes, marks, announcements..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-700"
            />
          </div>

          {/* Right Header: Clock, Ethiopian Time indicator, Profile Badge */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-800 flex items-center justify-end gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                {currentDate || "Thursday, Oct 9, 2026"}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Ethiopian Time • <span className="font-semibold text-purple-700">{currentTime || "10:24 AM"}</span>
              </p>
            </div>

            {/* Profile pill */}
            <Link
              href="/student/profile"
              className="flex items-center gap-3 pl-4 border-l border-slate-200 group hover:opacity-90 transition-opacity"
            >
              <Avatar className="w-9 h-9 ring-2 ring-purple-600/20 group-hover:ring-purple-600/40 transition-all">
                <AvatarImage src={student?.photo || ""} />
                <AvatarFallback className="bg-gradient-to-tr from-purple-700 to-indigo-600 text-white text-xs font-bold">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {displayName}
                </p>
                <p className="text-[11px] text-purple-700 font-semibold leading-tight">
                  {displayGrade} {displayStream}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* Page View Container */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {children}
        </main>

        {/* ─── Mobile Bottom Navigation ──────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex items-center justify-around z-40 shadow-lg">
          <Link
            href="/student"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname === "/student" ? "text-purple-700" : "text-slate-500"
            )}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </Link>
          <Link
            href="/student/classes"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/classes") ? "text-purple-700" : "text-slate-500"
            )}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span>Classes</span>
          </Link>
          <Link
            href="/student/marks"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/marks") ? "text-purple-700" : "text-slate-500"
            )}
          >
            <Award className="w-5 h-5 mb-0.5" />
            <span>Marks</span>
          </Link>
          <Link
            href="/student/attendance"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/attendance") ? "text-purple-700" : "text-slate-500"
            )}
          >
            <CalendarCheck className="w-5 h-5 mb-0.5" />
            <span>Attendance</span>
          </Link>
          <Link
            href="/student/profile"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/profile") ? "text-purple-700" : "text-slate-500"
            )}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
