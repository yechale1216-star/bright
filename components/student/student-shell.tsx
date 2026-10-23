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
  Sun,
  Moon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { studentDb } from "@/lib/db/student-db";
import { cn } from "@/lib/utils/utils";
import { useIsNativeApp } from "@/hooks/use-is-native-app";

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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [student, setStudent] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const isNative = useIsNativeApp();

  const isDark = mounted ? theme === "dark" : false;

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  useEffect(() => {
    setMounted(true);

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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070d1a] dark:text-slate-100 flex flex-col md:flex-row antialiased selection:bg-purple-500 selection:text-white transition-colors duration-200">
      {/* ─── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shrink-0 shadow-xs dark:shadow-xl border-r border-slate-200/80 dark:border-slate-800/80 z-30 justify-between transition-colors duration-200">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 pb-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-md shadow-purple-500/20 ring-2 ring-purple-100 dark:ring-purple-500/20 shrink-0 bg-white dark:bg-slate-900">
              {!logoError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src="/bright-path-logo.png"
                  alt="Bright Path Logo"
                  className="w-full h-full object-cover"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide leading-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Bright Path
              </h1>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Student Portal</p>
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
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/25 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      isActive
                        ? "text-white"
                        : "text-slate-400 dark:text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400"
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

        {/* Sidebar Footer: Theme Toggle & Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800/80 group cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-purple-600 dark:text-purple-400 transition-transform group-hover:scale-110">
                {isDark ? (
                  <Moon className="w-4 h-4 animate-in fade-in zoom-in duration-200" />
                ) : (
                  <Sun className="w-4 h-4 animate-in fade-in zoom-in duration-200" />
                )}
              </span>
              <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <div className="flex h-5 w-9 items-center rounded-full bg-purple-100 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800/60 px-0.5">
              <div
                className={cn(
                  "h-3.5 w-3.5 rounded-full bg-purple-600 shadow-xs transition-transform duration-300",
                  isDark ? "translate-x-4" : "translate-x-0"
                )}
              />
            </div>
          </button>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium rounded-xl h-9 px-3"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </Button>

          <div className="px-2 pt-1 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Student Portal</p>
            <p>Bright Path • Powered by Ethio Nova</p>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Header — matches admin TopNav style ───────────────────── */}
      <header className={cn(
        "md:hidden sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800",
        "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xs transition-colors duration-200",
        isNative && "pt-safe"
      )}>
        <div className="flex h-16 items-center px-3 gap-2">
          {/* ── Hamburger menu — LEFT (same as admin) ── */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl hover:bg-primary/10 transition-all active:scale-90 shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* ── Logo + Brand ── */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md shadow-purple-500/20 ring-2 ring-purple-100 dark:ring-purple-500/20 shrink-0 bg-white dark:bg-slate-900">
              {!logoError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src="/bright-path-logo.png"
                  alt="Bright Path Logo"
                  className="w-full h-full object-cover"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-black tracking-tight text-foreground truncate uppercase">Bright Path</h1>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold leading-none">Student Portal</p>
            </div>
          </div>

          {/* ── Right actions: theme toggle + avatar ── */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full border border-border bg-muted/40 hover:border-primary/50 transition-all shadow-2xs"
              aria-label="Toggle theme"
            >
              {isDark ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </Button>

            <Link href="/student/profile">
              <Avatar className="w-9 h-9 ring-2 ring-purple-500/30 hover:ring-purple-500/60 transition-all shadow-2xs">
                <AvatarImage src={student?.photo || ""} />
                <AvatarFallback className="bg-gradient-to-tr from-purple-700 to-indigo-600 text-white text-xs font-bold">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Mobile Drawer — slides from LEFT like admin sidebar ─────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative w-72 bg-white dark:bg-slate-900 text-slate-900 dark:text-white h-full flex flex-col justify-between p-4 shadow-2xl border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md ring-2 ring-purple-100 dark:ring-purple-500/20 shrink-0 bg-white dark:bg-slate-900">
                    {!logoError ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src="/bright-path-logo.png"
                        alt="Bright Path Logo"
                        className="w-full h-full object-cover"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">Bright Path</h2>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Student Portal</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Student info card */}
              <div className="my-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
                <Avatar className="w-10 h-10 ring-2 ring-purple-400/40">
                  <AvatarImage src={student?.photo || ""} />
                  <AvatarFallback className="bg-gradient-to-tr from-purple-700 to-indigo-600 text-white text-xs font-bold">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-xs text-slate-900 dark:text-white">{displayName}</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-300 font-medium">
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
                          ? "bg-purple-600 text-white font-semibold shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {/* Theme toggle inside drawer */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800/80"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-purple-600 dark:text-purple-400">
                    {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </span>
                  <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
                </div>
                <div className="flex h-5 w-9 items-center rounded-full bg-purple-100 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800/60 px-0.5">
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-full bg-purple-600 shadow-xs transition-transform duration-300",
                      isDark ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </div>
              </button>

              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white text-xs h-9 rounded-xl transition-colors"
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
        {/* Top Header Bar (Desktop & Tablet) — matches admin TopNav */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-20 shadow-xs transition-colors duration-200">
          {/* Search bar */}
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search classes, marks, announcements..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Right Header: Theme Toggle, Clock, Ethiopian Time indicator, Profile Badge */}
          <div className="flex items-center gap-4">
            {/* Quick theme toggle button in header */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </Button>

            <div className="text-right">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-end gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {currentDate || "Thursday, Oct 9, 2026"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Ethiopian Time • <span className="font-semibold text-purple-700 dark:text-purple-400">{currentTime || "10:24 AM"}</span>
              </p>
            </div>

            {/* Profile pill */}
            <Link
              href="/student/profile"
              className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800 group hover:opacity-90 transition-opacity"
            >
              <Avatar className="w-9 h-9 ring-2 ring-purple-600/20 group-hover:ring-purple-600/40 transition-all">
                <AvatarImage src={student?.photo || ""} />
                <AvatarFallback className="bg-gradient-to-tr from-purple-700 to-indigo-600 text-white text-xs font-bold">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  {displayName}
                </p>
                <p className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold leading-tight">
                  {displayGrade} {displayStream}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* Page View Container */}
        <main className={cn("flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto", isNative ? "pb-20 md:pb-8" : "pb-8")}>
          {children}
        </main>

        {/* ─── Mobile Bottom Navigation ──────────────────────────────────── */}
        {isNative && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1 flex items-center justify-around z-40 shadow-lg transition-colors duration-200">
            <Link
              href="/student"
              className={cn(
                "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
                pathname === "/student" ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <Home className="w-5 h-5 mb-0.5" />
              <span>Home</span>
            </Link>
          <Link
            href="/student/classes"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/classes") ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span>Classes</span>
          </Link>
          <Link
            href="/student/marks"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/marks") ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <Award className="w-5 h-5 mb-0.5" />
            <span>Marks</span>
          </Link>
          <Link
            href="/student/attendance"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/attendance") ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <CalendarCheck className="w-5 h-5 mb-0.5" />
            <span>Attendance</span>
          </Link>
          <Link
            href="/student/profile"
            className={cn(
              "flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors",
              pathname.startsWith("/student/profile") ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>Profile</span>
          </Link>
        </nav>
        )}
      </div>
    </div>
  );
}
