"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  BookOpen,
  Calendar,
  Sparkles,
  Bell,
  Clock,
  Layers,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { studentDb } from "@/lib/db/student-db";

export default function StudentAnnouncementsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studentDb.getAnnouncements(activeTab)
      .then((res) => {
        setAnnouncements(res);
      })
      .catch((err) => {
        console.error("[Announcements] Error fetching announcements:", err);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  const defaultAnnouncements = [
    {
      id: "1",
      title: "School will be closed on Meskel holiday.",
      message: "Bright Path will remain closed in celebration of the Meskel public holiday. Classes resume the following weekday.",
      category: "School",
      date: "2 days ago",
    },
    {
      id: "2",
      title: "Second term exam schedule is now available.",
      message: "The official academic timetable and assessment distribution for Term 2 has been published. Check your Timetable tab.",
      category: "Academic",
      date: "4 days ago",
    },
    {
      id: "3",
      title: "School cleanliness campaign.",
      message: "Join the student council and faculty for our annual campus environment and green school initiative.",
      category: "General",
      date: "5 days ago",
    },
    {
      id: "4",
      title: "New learning materials added for Mathematics.",
      message: "Chapter 4: Quadratic Equations practice slides and reference PDF have been uploaded by W/ro. Sara Y.",
      category: "Academic",
      date: "1 week ago",
    },
    {
      id: "5",
      title: "Parent-Teacher meeting on Oct 15, 2026.",
      message: "Annual first semester progress evaluation meetings with homeroom advisors and subject teachers.",
      category: "School",
      date: "1 week ago",
    },
  ];

  const itemsToDisplay = announcements.length > 0 ? announcements : defaultAnnouncements;
  const filteredItems =
    activeTab === "all"
      ? itemsToDisplay
      : itemsToDisplay.filter((a) => a.category?.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Announcements
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Official campus notices, academic updates, and school calendar events
        </p>
      </div>

      {/* Tabs Filter (Screen 8 in UI reference) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl w-full sm:w-auto grid grid-cols-4 sm:inline-flex mb-4">
          <TabsTrigger
            value="all"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="school"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
          >
            School
          </TabsTrigger>
          <TabsTrigger
            value="academic"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
          >
            Academic
          </TabsTrigger>
          <TabsTrigger
            value="general"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
          >
            General
          </TabsTrigger>
        </TabsList>

        <div className="space-y-3">
          {filteredItems.map((item, idx) => {
            const isSchool = item.category?.toLowerCase() === "school";
            const isAcademic = item.category?.toLowerCase() === "academic";

            return (
              <Card
                key={item.id || idx}
                className="rounded-2xl border-slate-200/80 shadow-sm bg-white hover:border-purple-200 hover:shadow-md transition-all p-4 md:p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Category icon */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isSchool
                        ? "bg-purple-100 text-purple-700"
                        : isAcademic
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {isSchool ? (
                      <Megaphone className="w-5 h-5" />
                    ) : isAcademic ? (
                      <BookOpen className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                        {typeof item.date === "string" && item.date.includes("T")
                          ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : item.date}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="pt-1.5 flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                      >
                        {item.category || "General"}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Bright Path Administration
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}
