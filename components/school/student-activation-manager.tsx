"use client";

import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KeyRound,
  RefreshCw,
  Printer,
  Users,
  Search,
  CheckCircle2,
  Clock,
  Download,
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  Filter,
  ChevronDown,
} from "lucide-react";
import { apiUrl } from "@/lib/api-config";

interface ActivationSlip {
  student_id: string;
  fullName: string;
  grade: string;
  section: string;
  activationCode: string;
  expiresAt: string;
}

interface StudentAccountRow {
  id: string;
  student_id: string;
  fullName: string;
  grade: string;
  section: string;
  accountStatus: string;
  activationCode?: string;
  activation_code_expires?: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("attendance_token") : null;
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SlipCard({ slip }: { slip: ActivationSlip }) {
  return (
    <div className="border-2 border-dashed border-purple-300 rounded-2xl p-4 bg-purple-50/60 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-purple-800 uppercase tracking-wide">Bright Path Student Portal</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{slip.fullName}</p>
          <p className="text-[11px] text-slate-500">
            {slip.student_id} · Grade {slip.grade} · Section {slip.section}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400">Expires</p>
          <p className="text-[11px] font-semibold text-slate-600">
            {new Date(slip.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-purple-200 p-3 text-center">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Activation Code</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl font-black tracking-[0.25em] text-purple-800 font-mono">{slip.activationCode}</span>
          <CopyButton text={slip.activationCode} />
        </div>
      </div>
      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        Visit <span className="font-semibold text-purple-700">brightpath.edu.et/student/activate</span> · Use your Student ID + this code to set your password
      </p>
    </div>
  );
}

export default function StudentActivationManager() {
  const [students, setStudents] = useState<StudentAccountRow[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentAccountRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDING_ACTIVATION" | "ACTIVE">("all");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSlips, setGeneratedSlips] = useState<ActivationSlip[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/students?status=ALL&limit=500`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        const rows: StudentAccountRow[] = (json.data?.students || json.data || []).map((s: any) => ({
          id: s.id,
          student_id: s.student_id,
          fullName: s.fullName || s.name,
          grade: s.grade || "",
          section: s.section || "",
          accountStatus: s.accountStatus || "PENDING_ACTIVATION",
          activationCode: s.activation_code,
          activation_code_expires: s.activation_code_expires,
        }));
        setStudents(rows);
        setFilteredStudents(rows);
        setFetched(true);
      } else {
        setError(json.message || "Failed to load students.");
      }
    } catch (err) {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply filters
  React.useEffect(() => {
    let result = [...students];
    if (statusFilter !== "all") result = result.filter((s) => s.accountStatus === statusFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (s) => s.fullName?.toLowerCase().includes(term) || s.student_id?.toLowerCase().includes(term)
      );
    }
    setFilteredStudents(result);
  }, [students, search, statusFilter]);

  const handleGenerate = async (studentId: string) => {
    setGeneratingId(studentId);
    try {
      const res = await fetch(`${apiUrl}/api/students/${studentId}/generate-activation-code`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setGeneratedSlips((prev) => {
          const filtered = prev.filter((s) => s.student_id !== json.data.student_id);
          return [json.data, ...filtered];
        });
        // Refresh the student in list
        setStudents((prev) =>
          prev.map((s) =>
            s.id === studentId
              ? { ...s, accountStatus: "PENDING_ACTIVATION", activationCode: json.data.activationCode }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Failed to generate code", err);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleBulkGenerate = async () => {
    const pendingStudents = filteredStudents.filter((s) => s.accountStatus === "PENDING_ACTIVATION" && !s.activationCode);
    if (pendingStudents.length === 0) {
      alert("No pending students without activation codes found.");
      return;
    }
    if (!confirm(`Generate activation codes for ${pendingStudents.length} students?`)) return;

    setBulkLoading(true);
    const slips: ActivationSlip[] = [];
    for (const s of pendingStudents) {
      try {
        const res = await fetch(`${apiUrl}/api/students/${s.id}/generate-activation-code`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && json.data) slips.push(json.data);
      } catch { /* continue */ }
    }
    setGeneratedSlips((prev) => [...slips, ...prev]);
    setStudents((prev) =>
      prev.map((s) => {
        const slip = slips.find((sl) => sl.student_id === s.student_id);
        return slip ? { ...s, activationCode: slip.activationCode } : s;
      })
    );
    setBulkLoading(false);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    // Build print slips from generated slips
    const slips = generatedSlips.map((s) => `
      <div class="slip">
        <div class="slip-header">
          <div>
            <div class="slip-brand">Bright Path Student Portal</div>
            <div class="slip-name">${s.fullName}</div>
            <div class="slip-meta">${s.student_id} · Grade ${s.grade} · Section ${s.section}</div>
          </div>
          <div class="slip-expires">
            <div>Expires</div>
            <div>${new Date(s.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
        </div>
        <div class="code-box">
          <div class="code-label">Activation Code</div>
          <div class="code">${s.activationCode}</div>
        </div>
        <div class="slip-footer">Visit brightpath.edu.et/student/activate<br/>Enter Student ID + code to activate your account</div>
      </div>
    `).join("");

    win.document.write(`
      <html>
        <head>
          <title>Bright Path Activation Slips</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
            body { background: white; padding: 20px; }
            .slip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
            .slip { border: 2px dashed #a855f7; border-radius: 16px; padding: 16px; break-inside: avoid; }
            .slip-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
            .slip-brand { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6b21a8; }
            .slip-name { font-size: 13px; font-weight: 700; color: #1e293b; margin: 2px 0; }
            .slip-meta { font-size: 10px; color: #64748b; }
            .slip-expires { font-size: 10px; color: #64748b; text-align: right; }
            .code-box { background: #f8fafc; border: 1px solid #d8b4fe; border-radius: 12px; padding: 12px; text-align: center; margin: 8px 0; }
            .code-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-bottom: 4px; }
            .code { font-size: 22px; font-weight: 900; letter-spacing: 0.3em; color: #6b21a8; font-family: monospace; }
            .slip-footer { font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.5; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="slip-grid">
            ${slips}
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const pendingCount = students.filter((s) => s.accountStatus === "PENDING_ACTIVATION").length;
  const activeCount = students.filter((s) => s.accountStatus === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-600" />
            Student Account Activation
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate and manage student activation codes for first-time login setup
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {generatedSlips.length > 0 && (
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Printer className="w-4 h-4" />
              Print {generatedSlips.length} Slip{generatedSlips.length > 1 ? "s" : ""}
            </Button>
          )}
          {!fetched ? (
            <Button onClick={fetchStudents} disabled={loading} className="gap-2 bg-purple-700 hover:bg-purple-800">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Load Students
            </Button>
          ) : (
            <Button
              onClick={handleBulkGenerate}
              disabled={bulkLoading}
              variant="outline"
              size="sm"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Bulk Generate
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {fetched && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{students.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Students</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            <p className="text-xs text-amber-600 mt-0.5">Pending Activation</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Active Accounts</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Generated slips preview */}
      {generatedSlips.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-600" />
              Generated Activation Slips ({generatedSlips.length})
            </h3>
            <button
              onClick={() => setGeneratedSlips([])}
              className="text-xs text-slate-400 hover:text-red-600 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2" ref={printRef}>
            {generatedSlips.map((slip) => (
              <SlipCard key={slip.student_id} slip={slip} />
            ))}
          </div>
        </div>
      )}

      {/* Student list */}
      {fetched && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm rounded-xl border-slate-200"
              />
            </div>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
              {([["all", "All"], ["PENDING_ACTIVATION", "Pending"], ["ACTIVE", "Active"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className={`px-3 py-2 transition-colors ${statusFilter === val ? "bg-purple-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                        No students found
                      </td>
                    </tr>
                  )}
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 text-sm">{s.fullName}</p>
                        <p className="text-xs text-slate-400">{s.student_id}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        Grade {s.grade} · {s.section}
                      </td>
                      <td className="px-4 py-3">
                        {s.accountStatus === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2.5 py-0.5">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.activationCode ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono font-bold text-purple-700 tracking-widest">{s.activationCode}</span>
                            <CopyButton text={s.activationCode} />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleGenerate(s.id)}
                          disabled={generatingId === s.id}
                          className="text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                        >
                          {generatingId === s.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          {s.activationCode ? "Regenerate" : "Generate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!fetched && !loading && (
        <div className="text-center py-16 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-100 mx-auto">
            <KeyRound className="w-7 h-7 text-purple-600" />
          </div>
          <p className="text-slate-700 font-semibold">Student Account Management</p>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Load students to view their account status, generate activation codes, and print slips for distribution.
          </p>
          <Button onClick={fetchStudents} className="mt-2 bg-purple-700 hover:bg-purple-800 gap-2">
            <Users className="w-4 h-4" /> Load Students
          </Button>
        </div>
      )}
    </div>
  );
}
