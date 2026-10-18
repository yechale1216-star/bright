"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Lock,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { studentDb } from "@/lib/db/student-db";

export default function StudentDisciplinePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentDb.getDiscipline()
      .then((res) => {
        setRecords(res);
      })
      .catch((err) => {
        console.error("[Discipline] Error loading discipline records:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const defaultRecords = [
    {
      id: "1",
      date: "2026-09-15",
      type: "Warning",
      description: "Late to class",
      status: "Resolved",
    },
    {
      id: "2",
      date: "2026-09-22",
      type: "Notice",
      description: "Uniform issue",
      status: "Resolved",
    },
    {
      id: "3",
      date: "2026-09-28",
      type: "Positive",
      description: "Helped in school event",
      status: "Active",
    },
  ];

  const displayRecords = records.length > 0 ? records : defaultRecords;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
            Discipline Records
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Student conduct history, commendations, notices, and resolution status
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-xl border border-border self-start sm:self-auto shadow-xs">
          <Lock className="w-3.5 h-3.5 text-primary" />
          <span>Strictly Read-Only</span>
        </div>
      </div>

      {/* Discipline Records Table Card */}
      <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold text-[11px]">
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Type</th>
                  <th className="py-3.5 px-6">Description</th>
                  <th className="py-3.5 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayRecords.map((item, idx) => {
                  const isPositive = item.type?.toLowerCase() === "positive";
                  const isWarning = item.type?.toLowerCase() === "warning";
                  const isResolved = item.status?.toLowerCase() === "resolved";

                  return (
                    <tr key={item.id || idx} className="hover:bg-accent/40 transition-colors">
                      <td className="py-4 px-6 font-mono text-foreground font-medium">
                        {item.date}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-lg ${
                            isPositive
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : isWarning
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {isPositive ? (
                            <Sparkles className="w-3 h-3" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <ShieldAlert className="w-3 h-3" />
                          )}
                          {item.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-foreground">
                        {item.description}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isResolved
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-primary/15 text-primary border-primary/30"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-muted/30 border-t border-border text-center text-xs text-muted-foreground">
            Certified by Bright Path Office of Student Affairs & Discipline
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
