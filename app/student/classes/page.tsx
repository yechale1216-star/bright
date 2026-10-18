"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Layers,
  GraduationCap,
  FolderDown,
  Mail,
  User,
  Sparkles,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { studentDb } from "@/lib/db/student-db";

export default function MyClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentDb.getClasses()
      .then((res) => {
        setClasses(res);
      })
      .catch((err) => {
        console.error("[Classes] Error fetching student classes:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const displayClasses = classes.length > 0 ? classes : [
    { id: "1", name: "Mathematics", code: "MATH", color: "#f59e0b", teacher: "W/ro. Sara Y.", materialsCount: 12 },
    { id: "2", name: "Physics", code: "PHYS", color: "#3b82f6", teacher: "Ato Abebe K.", materialsCount: 9 },
    { id: "3", name: "Chemistry", code: "CHEM", color: "#10b981", teacher: "W/ro. Mihret A.", materialsCount: 8 },
    { id: "4", name: "Biology", code: "BIO", color: "#059669", teacher: "Ato Getachew T.", materialsCount: 7 },
    { id: "5", name: "English", code: "ENG", color: "#ef4444", teacher: "W/ro. Selam B.", materialsCount: 10 },
    { id: "6", name: "Geography", code: "GEO", color: "#8b5cf6", teacher: "Ato Daniel F.", materialsCount: 4 },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          My Classes
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Enrolled subjects, assigned teachers, and class learning resources
        </p>
      </div>

      <Tabs defaultValue="subjects" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl w-full sm:w-auto grid grid-cols-2 sm:inline-flex mb-4">
          <TabsTrigger
            value="subjects"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
          >
            Current Subjects
          </TabsTrigger>
          <TabsTrigger
            value="teachers"
            className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
          >
            Teachers
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Current Subjects (Screen 4 in UI reference) */}
        <TabsContent value="subjects" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayClasses.map((sub) => (
              <Card
                key={sub.id}
                className="rounded-2xl border-slate-200/80 shadow-sm bg-white hover:border-purple-200 transition-all hover:shadow-md"
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Subject color icon */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                      style={{ backgroundColor: sub.color || "#6366f1" }}
                    >
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {sub.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Teacher: {sub.teacher}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="rounded-xl text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 shrink-0"
                  >
                    <Link href={`/student/materials?subjectId=${sub.id}`}>
                      View Materials
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Assigned Teachers */}
        <TabsContent value="teachers" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayClasses.map((sub) => (
              <Card key={`teacher-${sub.id}`} className="rounded-2xl border-slate-200/80 shadow-sm bg-white p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 ring-2 ring-purple-500/20">
                    <AvatarFallback className="bg-purple-100 text-purple-800 font-bold text-sm">
                      {sub.teacher.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{sub.teacher}</h4>
                    <p className="text-[11px] font-semibold text-purple-700">{sub.name} Teacher</p>
                    <span className="text-[10px] text-slate-400">Bright Path Faculty</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{sub.materialsCount || 8} files uploaded</span>
                  <Button variant="ghost" size="sm" asChild className="text-xs text-purple-700 h-7 px-2">
                    <Link href={`/student/materials?subjectId=${sub.id}`}>
                      Materials
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
