'use client';

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Printer,
  FileText,
  Calendar,
  Sparkles,
  RefreshCw,
  User,
} from 'lucide-react';
import {
  gradebookService,
  ComprehensiveReportCardData
} from '@/lib/gradebook-service';
import { Button } from '@/components/ui/button';
import { StudentReportCard } from '@/components/school/student-report-card';

export default function ParentAcademicsPage() {
  const [comprehensiveCard, setComprehensiveCard] = useState<ComprehensiveReportCardData | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string>('annual');
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    // 1. Resolve linked students list
    let list: any[] = [];
    const storedStudents = localStorage.getItem('parent_students');
    if (storedStudents) {
      try {
        list = JSON.parse(storedStudents);
        if (Array.isArray(list)) setStudents(list);
      } catch {}
    }

    // 2. Resolve selected student
    let activeId = localStorage.getItem('parent_selected_student_id');
    if (!activeId && list.length > 0) {
      activeId = list[0].id;
      if (activeId) {
        localStorage.setItem('parent_selected_student_id', activeId);
      }
    }

    setStudentId(activeId);
    if (activeId) {
      loadCard(activeId, selectedTerm);
    }
  }, [selectedTerm]);

  const handleSelectStudent = (id: string) => {
    setStudentId(id);
    localStorage.setItem('parent_selected_student_id', id);
    loadCard(id, selectedTerm);
  };

  const loadCard = async (sId: string, term: string) => {
    try {
      setLoading(true);
      const card = await gradebookService.getComprehensiveReportCard(
        sId,
        undefined,
        term !== 'annual' ? term : undefined
      );
      setComprehensiveCard(card);
    } catch (err) {
      console.error('Failed to load parent report card:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1536px] mx-auto space-y-5 sm:space-y-6 print:p-0">
      {/* Header (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Academic Progress & Grades</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Official evaluations, examination results, and printable term report cards.
            </p>
          </div>
        </div>

        {comprehensiveCard && (
          <Button onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground font-semibold shrink-0">
            <Printer className="w-4 h-4" />
            Print Report Card (A4)
          </Button>
        )}
      </div>

      {/* Child Switcher (Hidden in Print) */}
      {students.length > 1 && (
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/40 border border-border print:hidden overflow-x-auto no-scrollbar max-w-full">
          <span className="text-xs font-bold text-muted-foreground uppercase px-2 flex items-center gap-1.5 shrink-0">
            <User className="w-3.5 h-3.5" />
            Child:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {students.map((st) => (
              <button
                key={st.id}
                onClick={() => handleSelectStudent(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  studentId === st.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-background text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <span>{st.name || st.fullName}</span>
                {st.grade && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${studentId === st.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {st.grade}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Period Switcher (Hidden in Print) */}
      <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl bg-card border border-border print:hidden overflow-x-auto no-scrollbar max-w-full shadow-2xs">
        <span className="text-xs font-semibold text-muted-foreground uppercase px-2 shrink-0">Report Period:</span>
        <button
          onClick={() => setSelectedTerm('annual')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            selectedTerm === 'annual'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          ★ Annual Cumulative (Full Year)
        </button>
        <button
          onClick={() => setSelectedTerm('sem1')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            selectedTerm === 'sem1'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          Semester 1
        </button>
        <button
          onClick={() => setSelectedTerm('sem2')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
            selectedTerm === 'sem2'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          Semester 2
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center text-muted-foreground print:hidden">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          Loading student report card...
        </div>
      ) : !comprehensiveCard ? (
        <div className="py-20 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border print:hidden">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Report Card Available</h3>
          <p className="text-xs max-w-sm mx-auto mt-1 text-muted-foreground">
            Report cards for this student will appear here once compiled by the school administration.
          </p>
        </div>
      ) : (
        /* The Authentic Addis Hiwot Report Card */
        <div className="w-full overflow-x-auto rounded-2xl border border-border/80 bg-slate-100/60 p-2 sm:p-6 scrollbar-thin">
          <div className="min-w-fit flex justify-center">
            <StudentReportCard card={comprehensiveCard} />
          </div>
        </div>
      )}
    </div>
  );
}
