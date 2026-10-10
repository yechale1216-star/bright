"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Award,
  History,
  Layers,
  Sparkles,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { studentDb } from "@/lib/db/student-db";

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentDb.getProfile()
      .then((res) => {
        setProfile(res);
      })
      .catch((err) => {
        console.error("[Profile] Error loading profile:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const basic = profile?.basicInfo || {
    fullName: "Amanuel Tesfaye",
    studentId: "AH-2026-00125",
    grade: "12",
    section: "A",
    stream: "Natural",
    academicYear: "2026/27",
    dateOfBirth: "2010-03-15",
    gender: "Male",
    phone: "+251 91 234 5678",
    address: "Dire Dawa, Ethiopia",
    status: "ACTIVE",
  };

  const history = profile?.academicHistory || [
    {
      id: "h1",
      year: "2026/27",
      grade: "Grade 12",
      section: "Section A",
      stream: "Natural Science",
      status: "CURRENT",
    },
    {
      id: "h2",
      year: "2025/26",
      grade: "Grade 11",
      section: "Section B",
      stream: "Natural Science",
      status: "PROMOTED",
    },
    {
      id: "h3",
      year: "2024/25",
      grade: "Grade 10",
      section: "Section A",
      stream: "General",
      status: "PROMOTED",
    },
  ];

  const contact = profile?.contactInfo || {
    parentName: "Tesfaye Wolde",
    parentPhone: "+251 91 234 5678",
    parentEmail: "tesfaye.w@gmail.com",
    address: "Dire Dawa, Ethiopia",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Student Profile
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Academic identity, enrollment records, and school registry details
        </p>
      </div>

      {/* Hero Profile Card */}
      <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 relative" />
        <CardContent className="px-6 pb-6 relative pt-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-14 mb-4 gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
              <Avatar className="w-24 h-24 ring-4 ring-white shadow-xl shadow-purple-900/10">
                <AvatarImage src={basic.photo || ""} />
                <AvatarFallback className="bg-gradient-to-tr from-purple-700 to-indigo-600 text-white text-2xl font-black">
                  {basic.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-xl font-black text-slate-900">{basic.fullName}</h3>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px] px-2 py-0.5">
                    Active
                  </Badge>
                </div>
                <p className="text-xs font-mono font-bold text-purple-700">{basic.studentId}</p>
                <p className="text-xs text-slate-500 font-semibold">
                  Grade {basic.grade} • {basic.stream || "General"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Lock className="w-3.5 h-3.5 text-purple-600" />
              <span>Read-Only Academic Record</span>
            </div>
          </div>

          {/* Profile Tabs */}
          <Tabs defaultValue="basic" className="w-full mt-6">
            <TabsList className="bg-slate-100/80 p-1 rounded-2xl w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
              <TabsTrigger
                value="basic"
                className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
              >
                Basic Info
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
              >
                Academic History
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                className="rounded-xl text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white transition-all"
              >
                Contact Info
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Basic Info */}
            <TabsContent value="basic" className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Full Name</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.fullName}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Student ID</p>
                  <p className="text-xs font-mono font-bold text-purple-700 mt-0.5">{basic.studentId}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Current Grade & Section</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">Grade {basic.grade} - Section {basic.section}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Academic Stream</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.stream || "General"}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Academic Year</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.academicYear}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Date of Birth</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.dateOfBirth}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Gender</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.gender}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Phone</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.phone}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 sm:col-span-2">
                  <p className="text-[11px] font-semibold text-slate-400">Residential Address</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{basic.address}</p>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Academic History */}
            <TabsContent value="history" className="pt-5 space-y-4">
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-100 text-xs text-purple-900 leading-relaxed mb-3">
                <span className="font-bold">Academic-Year Architecture:</span> Your complete student records across all academic years are preserved under your single student identity.
              </div>

              <div className="space-y-3">
                {history.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{item.year}</span>
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 ${
                            item.status === "CURRENT"
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-slate-600">
                        {item.grade} • {item.section} • {item.stream}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-400">Status</span>
                      <p className="text-xs font-bold text-slate-700">Certified by School</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Tab 3: Contact Info */}
            <TabsContent value="contact" className="pt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Parent / Guardian Name</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{contact.parentName}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Parent Contact Phone</p>
                  <p className="text-xs font-bold text-purple-700 mt-0.5">{contact.parentPhone}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Parent Email Address</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{contact.parentEmail}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400">Emergency Address</p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">{contact.address}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
