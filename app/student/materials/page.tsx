"use client";

import React, { useState, useEffect } from "react";
import {
  FolderDown,
  Download,
  FileText,
  FileSpreadsheet,
  Film,
  BookOpen,
  Filter,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentDb } from "@/lib/db/student-db";

export default function StudentMaterialsPage() {
  const [subject, setSubject] = useState("all");
  const [fileType, setFileType] = useState("all");
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    studentDb.getMaterials(subject, fileType)
      .then((res) => {
        setMaterials(res);
      })
      .catch((err) => {
        console.error("[Materials] Error fetching learning materials:", err);
      })
      .finally(() => setLoading(false));
  }, [subject, fileType]);

  const defaultMaterials = [
    {
      id: "1",
      subject: "Mathematics",
      color: "#f59e0b",
      title: "Chapter 4: Quadratic Equations (Slides)",
      meta: "PDF • 2.4 MB",
      fileType: "PDF",
      fileUrl: "#",
    },
    {
      id: "2",
      subject: "Physics",
      color: "#3b82f6",
      title: "Forces and Motion (Notes)",
      meta: "PDF • 1.8 MB",
      fileType: "PDF",
      fileUrl: "#",
    },
    {
      id: "3",
      subject: "Chemistry",
      color: "#10b981",
      title: "Chemical Reactions (Slides)",
      meta: "PPTX • 4.5 MB",
      fileType: "Slides",
      fileUrl: "#",
    },
    {
      id: "4",
      subject: "Biology",
      color: "#059669",
      title: "Cell Structure (PDF)",
      meta: "PDF • 3.1 MB",
      fileType: "PDF",
      fileUrl: "#",
    },
  ];

  const itemsToDisplay = materials.length > 0 ? materials : defaultMaterials;

  const handleDownload = (item: any) => {
    if (item.fileUrl && item.fileUrl !== "#") {
      window.open(item.fileUrl, "_blank");
    } else {
      // Mock download feedback
      alert(`Downloading ${item.title} (${item.meta || "PDF"})...`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Learning Materials
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Class notes, presentation slides, exercise worksheets, and reference guides
          </p>
        </div>

        {/* Filters (Screen 10 in UI reference) */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Subject Filter */}
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-36 h-9 rounded-xl bg-white border-slate-200 text-xs font-semibold text-slate-800">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="math">Mathematics</SelectItem>
              <SelectItem value="phys">Physics</SelectItem>
              <SelectItem value="chem">Chemistry</SelectItem>
              <SelectItem value="bio">Biology</SelectItem>
            </SelectContent>
          </Select>

          {/* Type Filter */}
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger className="w-32 h-9 rounded-xl bg-white border-slate-200 text-xs font-semibold text-slate-800">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="slides">Slides</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Materials List Cards (Screen 10 in UI reference) */}
      <div className="space-y-3">
        {itemsToDisplay.map((item, idx) => (
          <Card
            key={item.id || idx}
            className="rounded-2xl border-slate-200/80 shadow-sm bg-white hover:border-purple-200 hover:shadow-md transition-all"
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {/* Subject color icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color || item.subjectColor || "#6366f1" }}
                >
                  <BookOpen className="w-6 h-6 text-white" />
                </div>

                <div className="min-w-0 space-y-0.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    {item.subject}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    {item.meta || `${item.fileType || "PDF"} • ${item.fileSize || "2.4 MB"}`}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(item)}
                className="rounded-xl text-xs font-semibold text-purple-700 border-purple-200 hover:bg-purple-50 shrink-0 h-9 px-4 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
