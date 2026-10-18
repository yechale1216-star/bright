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

  const FALLBACK_CLASSES = [
    { id: "1", subject: "Mathematics", subjectCode: "MATH", subjectColor: "#f59e0b", teacher: "W/ro. Sara Y.", materialsCount: 12 },
    { id: "2", subject: "Physics", subjectCode: "PHYS", subjectColor: "#3b82f6", teacher: "Ato Abebe K.", materialsCount: 9 },
    { id: "3", subject: "Chemistry", subjectCode: "CHEM", subjectColor: "#10b981", teacher: "W/ro. Mihret A.", materialsCount: 8 },
    { id: "4", subject: "Biology", subjectCode: "BIO", subjectColor: "#059669", teacher: "Ato Getachew T.", materialsCount: 7 },
    { id: "5", subject: "English", subjectCode: "ENG", subjectColor: "#ef4444", teacher: "W/ro. Selam B.", materialsCount: 10 },
    { id: "6", subject: "Geography", subjectCode: "GEO", subjectColor: "#8b5cf6", teacher: "Ato Daniel F.", materialsCount: 4 },
  ];

  const rawList = classes.length > 0 ? classes : (!loading ? FALLBACK_CLASSES : []);
  const displayClasses = (rawList.length > 0 ? rawList : FALLBACK_CLASSES).map((item: any, idx: number) => ({
    id: item.subjectId || item.id || `cls-${idx}`,
    name: item.subject || item.subjectName || item.name || "Subject",
    code: item.subjectCode || item.code || "",
    color: item.subjectColor || item.color || "#8B2CF5",
    teacher: item.teacher || item.teacherName || "TBA",
    materialsCount: item.materialsCount ?? 8,
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
          My Classes
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enrolled subjects, assigned teachers, and class learning resources
        </p>
      </div>

      <Tabs defaultValue="subjects" className="w-full">
        <TabsList className="bg-card/80 border border-border p-1 rounded-2xl w-full sm:w-auto grid grid-cols-2 sm:inline-flex mb-4">
          <TabsTrigger
            value="subjects"
            className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
          >
            Current Subjects
          </TabsTrigger>
          <TabsTrigger
            value="teachers"
            className="rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white transition-all"
          >
            Teachers
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Current Subjects */}
        <TabsContent value="subjects" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
            {displayClasses.map((sub) => (
              <Card
                key={sub.id}
                className="rounded-2xl border-border shadow-xs bg-card hover:border-primary/40 transition-all hover:shadow-md"
              >
                <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2.5 sm:gap-3 min-w-0">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    {/* Subject color icon */}
                    <div
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0"
                      style={{ backgroundColor: sub.color || "#8B2CF5" }}
                    >
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-foreground leading-tight truncate">
                          {sub.name}
                        </h4>
                        {sub.code && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground font-mono">
                            {sub.code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-0.5 truncate">
                        Teacher: <span className="text-foreground/90 font-semibold">{sub.teacher}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="rounded-xl text-[11px] sm:text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 shrink-0 h-8 px-2.5 sm:px-3"
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
              <Card key={`teacher-${sub.id}`} className="rounded-2xl border-border shadow-sm bg-card p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary/15 text-primary font-bold text-sm">
                      {(sub.teacher || "T").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{sub.teacher}</h4>
                    <p className="text-[11px] font-semibold text-primary">{sub.name} Teacher</p>
                    <span className="text-[10px] text-muted-foreground">Bright Path Faculty</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">{sub.materialsCount || 8} files uploaded</span>
                  <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2">
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
