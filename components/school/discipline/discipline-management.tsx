'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Paperclip,
  Eye,
  Trash2,
  Edit,
  Send,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  X,
  Tag,
  BarChart3,
  ClipboardList,
  Layers,
  Sparkles,
  ExternalLink,
  Check,
  UserCheck,
  Phone,
  Mail,
  Users,
  GraduationCap,
  ShieldCheck,
  RefreshCw,
  Scale
} from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/api-config';
import { db } from '@/lib/db/database';
import { useCalendar } from '@/lib/context/calendar-context';

import {
  DisciplineApi,
  StudentDiscipline,
  DisciplineCategory,
  DisciplineAnalytics
} from '@/lib/discipline-service';

const DEFAULT_FALLBACK_CATEGORIES: DisciplineCategory[] = [
  'Late Arrival',
  'Unexcused Absence',
  'Uniform Violation',
  'Classroom Misbehavior',
  'Disrespect',
  'Bullying',
  'Fighting',
  'Cheating',
  'Phone Misuse',
  'Property Damage',
  'Theft',
  'Smoking',
  'Violence',
  'Other'
].map((name) => ({ id: name, schoolId: '', name, isDefault: true }));

interface DisciplineManagementProps {
  userRole?: 'school_admin' | 'teacher' | 'super_admin' | 'discipline_officer';
  initialTab?: 'incidents' | 'analytics' | 'categories';
}

export function DisciplineManagement({ userRole = 'school_admin', initialTab = 'incidents' }: DisciplineManagementProps) {
  const { formatDate } = useCalendar();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incidents' | 'analytics' | 'categories'>(initialTab);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // Data States
  const [incidents, setIncidents] = useState<StudentDiscipline[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<DisciplineAnalytics | null>(null);
  const [categories, setCategories] = useState<DisciplineCategory[]>(DEFAULT_FALLBACK_CATEGORIES);
  
  // Filter States
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [streamFilter, setStreamFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Refs to hold current filter/pagination values for stable event callbacks
  // (prevents stale closure bug in event listeners & polling intervals)
  const pageRef = useRef(page);
  const searchRef = useRef(search);
  const severityFilterRef = useRef(severityFilter);
  const statusFilterRef = useRef(statusFilter);
  const categoryFilterRef = useRef(categoryFilter);
  const streamFilterRef = useRef(streamFilter);
  const startDateFilterRef = useRef(startDateFilter);
  const endDateFilterRef = useRef(endDateFilter);
  
  // Students List for Wizard
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);
  const [showStudentResults, setShowStudentResults] = useState(false);
  const [studentSearchSubmitted, setStudentSearchSubmitted] = useState(false);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [selectedIncident, setSelectedIncident] = useState<StudentDiscipline | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  
  // Follow-up state inside detail
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpAction, setFollowUpAction] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<string>('');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  // Form State for Wizard
  const [formData, setFormData] = useState({
    studentId: '',
    selectedStudentName: '',
    selectedStudentGrade: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    categoryName: 'Classroom Misbehavior',
    categoryId: '',
    severity: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    title: '',
    description: '',
    location: '',
    witnessesText: '',
    immediateAction: '',
    evidence: [] as { url: string; name: string; type: string; size?: number }[],
    parentNotified: true,
    followUpDate: ''
  });

  // Upload progress helper
  const [isUploading, setIsUploading] = useState(false);

  // Sync refs whenever state changes so callbacks always read fresh values
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { severityFilterRef.current = severityFilter; }, [severityFilter]);
  useEffect(() => { statusFilterRef.current = statusFilter; }, [statusFilter]);
  useEffect(() => { categoryFilterRef.current = categoryFilter; }, [categoryFilter]);
  useEffect(() => { streamFilterRef.current = streamFilter; }, [streamFilter]);
  useEffect(() => { startDateFilterRef.current = startDateFilter; }, [startDateFilter]);
  useEffect(() => { endDateFilterRef.current = endDateFilter; }, [endDateFilter]);

  // Stable fetch — reads from refs so it is safe to call from event listeners
  // and polling intervals without creating stale closures
  const fetchIncidentsStable = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await DisciplineApi.getIncidents({
        page: pageRef.current,
        limit: 15,
        search: searchRef.current,
        severity: severityFilterRef.current === 'ALL' ? undefined : severityFilterRef.current,
        status: statusFilterRef.current === 'ALL' ? undefined : statusFilterRef.current,
        categoryName: categoryFilterRef.current === 'ALL' ? undefined : categoryFilterRef.current,
        streamId: streamFilterRef.current === 'ALL' ? undefined : streamFilterRef.current,
        startDate: startDateFilterRef.current || undefined,
        endDate: endDateFilterRef.current || undefined
      });
      setIncidents(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load discipline records');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Convenience alias for direct calls with current state (no ref indirection needed)
  const fetchIncidents = fetchIncidentsStable;

  const fetchAnalyticsAndCategories = async () => {
    try {
      const [ana, cats] = await Promise.all([
        DisciplineApi.getAnalytics().catch(() => null),
        DisciplineApi.getCategories().catch(() => [])
      ]);
      if (ana) setAnalytics(ana);
      if (cats && Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
      } else {
        setCategories(DEFAULT_FALLBACK_CATEGORIES);
      }
    } catch (err) {
      console.error('Error fetching analytics/categories:', err);
      setCategories(DEFAULT_FALLBACK_CATEGORIES);
    }
  };

  useEffect(() => {
    fetchIncidentsStable();
  }, [page, search, severityFilter, statusFilter, categoryFilter, streamFilter, startDateFilter, endDateFilter, fetchIncidentsStable]);

  useEffect(() => {
    fetchAnalyticsAndCategories();

    // Use stable ref-based fetch so the listener always uses current filter values
    const handleDisciplineChanged = () => {
      fetchIncidentsStable();
      fetchAnalyticsAndCategories();
    };

    window.addEventListener("disciplineDataChanged", handleDisciplineChanged);

    // Background polling every 30 seconds for multi-user/multi-tab sync
    const pollInterval = setInterval(() => {
      fetchIncidentsStable();
      fetchAnalyticsAndCategories();
    }, 30_000);

    return () => {
      window.removeEventListener("disciplineDataChanged", handleDisciplineChanged);
      clearInterval(pollInterval);
    };
  }, [fetchIncidentsStable]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    // fetchIncidentsStable reads searchRef which is synced via useEffect,
    // but since setPage(1) is async, we call after a microtask to ensure
    // pageRef is updated before the fetch runs
    setTimeout(() => fetchIncidentsStable(), 0);
  };

  // On-demand student search for wizard Step 1
  const fetchStudents = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Clear old results immediately so stale results never show
    setStudents([]);
    setIsLoadingStudents(true);
    setShowStudentResults(true);
    setStudentSearchSubmitted(true);

    try {
      const token = localStorage.getItem('attendance_token');
      const schoolId = localStorage.getItem('x-school-id');
      const apiUrl = getApiUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (schoolId) headers['x-school-id'] = schoolId;

      const res = await fetch(
        `${apiUrl}/api/students?search=${encodeURIComponent(trimmed)}&limit=20`,
        { headers }
      );
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setStudents([]);
        return;
      }
      const data = await res.json();
      const rawList: any[] = data.students || data.data || [];

      // Client-side double filter — ensures results always match what user typed
      const lowerQ = trimmed.toLowerCase();
      const filtered = rawList.filter((s) => {
        const name = (s.fullName || s.name || '').toLowerCase();
        const id = (s.student_id || '').toLowerCase();
        return name.includes(lowerQ) || id.includes(lowerQ);
      });

      setStudents(filtered);
    } catch (err) {
      console.error('Error loading students:', err);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Debounced auto-search as user types
  useEffect(() => {
    if (!studentSearchSubmitted) return;
    if (!studentSearch.trim()) {
      setStudents([]);
      setShowStudentResults(false);
      return;
    }
    setStudents([]); // clear immediately before debounce fires
    const t = setTimeout(() => fetchStudents(studentSearch), 400);
    return () => clearTimeout(t);
  }, [studentSearch]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: { url: string; name: string; type: string; size?: number }[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        newAttachments.push({
          url: base64Url,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size
        });

        if (newAttachments.length === files.length) {
          setFormData((prev) => ({
            ...prev,
            evidence: [...prev.evidence, ...newAttachments]
          }));
          setIsUploading(false);
          toast.success(`${files.length} evidence file(s) attached`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveEvidence = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      evidence: prev.evidence.filter((_, i) => i !== index)
    }));
  };

  const handleCreateIncidentSubmit = async () => {
    if (!formData.studentId) {
      toast.error('Please select a student');
      return;
    }
    if (!formData.title || !formData.description) {
      toast.error('Title and detailed description are required');
      return;
    }

    setIsSubmittingIncident(true);
    try {
      const witnesses = formData.witnessesText
        ? formData.witnessesText.split(',').map((w) => w.trim()).filter(Boolean)
        : [];

      await DisciplineApi.createIncident({
        studentId: formData.studentId,
        date: formData.date,
        time: formData.time,
        categoryId: formData.categoryId || undefined,
        categoryName: formData.categoryName,
        severity: formData.severity,
        title: formData.title,
        description: formData.description,
        location: formData.location,
        witnesses,
        evidence: formData.evidence,
        immediateAction: formData.immediateAction,
        parentNotified: formData.parentNotified,
        followUpDate: formData.followUpDate || undefined
      });

      toast.success('Discipline incident created successfully!');
      setIsCreateOpen(false);
      setCreateStep(1);
      setFormData({
        studentId: '',
        selectedStudentName: '',
        selectedStudentGrade: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        categoryName: 'Classroom Misbehavior',
        categoryId: '',
        severity: 'LOW',
        title: '',
        description: '',
        location: '',
        witnessesText: '',
        immediateAction: '',
        evidence: [],
        parentNotified: true,
        followUpDate: ''
      });

      fetchIncidents();
      fetchAnalyticsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save incident');
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  const handleAddFollowUpSubmit = async () => {
    if (!selectedIncident || !followUpNote.trim()) {
      toast.error('Follow-up note is required');
      return;
    }

    setIsSubmittingFollowUp(true);
    try {
      await DisciplineApi.addFollowUp(selectedIncident.id, {
        note: followUpNote,
        actionTaken: followUpAction || undefined,
        status: followUpStatus || undefined
      });

      toast.success('Follow-up note added');
      setFollowUpNote('');
      setFollowUpAction('');

      // Refresh single incident
      const updated = await DisciplineApi.getIncidentById(selectedIncident.id);
      setSelectedIncident(updated);
      fetchIncidents();
      fetchAnalyticsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add follow-up');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const handleStatusChange = async (newStatus: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED') => {
    if (!selectedIncident) return;
    try {
      const updated = await DisciplineApi.updateIncident(selectedIncident.id, {
        status: newStatus,
        notifyParent: true
      });
      setSelectedIncident(updated);
      toast.success(`Status updated to ${newStatus}`);
      fetchIncidents();
      fetchAnalyticsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discipline record? This action cannot be undone.')) return;
    try {
      await DisciplineApi.deleteIncident(id);
      toast.success('Incident deleted');
      if (selectedIncident?.id === id) setIsDetailOpen(false);
      fetchIncidents();
      fetchAnalyticsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await DisciplineApi.createCategory(newCategoryName, newCategoryDesc);
      toast.success('Category added');
      setNewCategoryName('');
      setNewCategoryDesc('');
      setIsCategoryModalOpen(false);
      fetchAnalyticsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await DisciplineApi.deleteCategory(id);
      toast.success('Category deleted');
      fetchAnalyticsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const exportToCSV = () => {
    if (incidents.length === 0) {
      toast.error('No records to export');
      return;
    }
    const headers = ['Student ID', 'Student Name', 'Grade', 'Section', 'Date', 'Time', 'Category', 'Severity', 'Title', 'Status', 'Reporter', 'Parent Acknowledged'];
    const rows = incidents.map(inc => [
      `"${inc.student?.student_id || ''}"`,
      `"${inc.student?.fullName || ''}"`,
      `"${inc.grade?.name || ''}"`,
      `"${inc.section?.name || ''}"`,
      `"${new Date(inc.date).toLocaleDateString()}"`,
      `"${inc.time || ''}"`,
      `"${inc.categoryName}"`,
      `"${inc.severity}"`,
      `"${inc.title.replace(/"/g, '""')}"`,
      `"${inc.status}"`,
      `"${inc.reportedByName || ''}"`,
      `"${inc.parentAcknowledged ? 'Yes' : 'No'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Zetime_Discipline_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Discipline report exported to CSV');
  };

  // Severity Colors Helper
  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'LOW':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">Low</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">Medium</Badge>;
      case 'HIGH':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">High</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-900 text-red-100 border-red-950 dark:bg-red-950 dark:text-red-200 dark:border-red-900 animate-pulse">Critical</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">Open</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400">Under Review</Badge>;
      case 'RESOLVED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      {/* Top Header Card / Hero Banner */}
      <div className="relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-900 p-6 md:p-8 rounded-3xl border border-amber-500/20 shadow-2xl shadow-amber-500/5 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="p-4 bg-amber-500/15 text-amber-500 dark:text-amber-400 rounded-2xl border border-amber-500/30 shadow-inner flex-shrink-0">
            <Scale className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                Officer Conduct Dashboard
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200">{user?.name || 'Officer'}</span>
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-300 mt-1 max-w-2xl">
              Track, investigate, log, and communicate student conduct and behavioral reports across the school.
            </p>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-3">
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="rounded-2xl font-bold text-xs h-11 px-5 bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>

          <Button
            onClick={() => {
              setCreateStep(1);
              setIsCreateOpen(true);
            }}
            className="rounded-2xl font-bold text-xs h-11 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25 border-none transition-all transform hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Report Incident
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full space-y-6">
        {userRole !== 'discipline_officer' && (
          <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 inline-flex">
            <TabsTrigger value="incidents" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
              <ClipboardList className="w-4 h-4" />
              Incidents Directory
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard & Analytics
            </TabsTrigger>
            {(userRole === 'school_admin' || userRole === 'super_admin') && (
              <TabsTrigger value="categories" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
                <Layers className="w-4 h-4" />
                Custom Categories
              </TabsTrigger>
            )}
          </TabsList>
        )}

        {/* TAB 1: INCIDENTS DIRECTORY */}
        <TabsContent value="incidents" className="space-y-6 mt-6 focus-visible:outline-none">
          {/* Quick Metrics Header Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Incidents</p>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1">{analytics?.total || 0}</p>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Open Cases</p>
                  <p className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {analytics?.openCases || 0}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resolved Cases</p>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {analytics?.resolvedCases || 0}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Critical Cases</p>
                  <p className="text-2xl md:text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {analytics?.criticalCases || 0}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600">
                  <AlertOctagon className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all col-span-2 md:col-span-1">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">This Month</p>
                  <p className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {analytics?.thisMonth || 0}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600">
                  <Calendar className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-100 dark:border-slate-800 rounded-3xl p-5">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search student, student ID, incident title, or reporter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 rounded-2xl text-sm font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val)}>
                  <SelectTrigger className="w-[140px] h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Severities</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                  <SelectTrigger className="w-[140px] h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
                  <SelectTrigger className="w-[180px] h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id || cat.name} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button type="submit" variant="secondary" className="h-11 rounded-2xl px-5 font-bold text-xs">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </form>
          </Card>

          {/* Incidents Data Table */}
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : incidents.length === 0 ? (
              <div className="py-20 text-center space-y-3 px-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-8 h-8 text-slate-400/60" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">No Discipline Records Found</h3>
                <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                  There are no incidents matching your current search and filter criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Grade & Section</th>
                      <th className="px-6 py-4">Incident Title & Category</th>
                      <th className="px-6 py-4">Severity</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Parent Notified</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {incidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 font-medium">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {inc.student?.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              ID: {inc.student?.student_id}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium text-xs">
                          {inc.grade?.name || 'Grade'} - {inc.section?.name || 'Section'}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">{inc.title}</p>
                          <span className="inline-block mt-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                            {inc.categoryName}
                          </span>
                        </td>
                        <td className="px-6 py-4">{getSeverityBadge(inc.severity)}</td>
                        <td className="px-6 py-4">{getStatusBadge(inc.status)}</td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                          {formatDate(inc.date)}
                          <span className="block text-[10px] text-slate-400">{inc.time}</span>
                        </td>
                        <td className="px-6 py-4">
                          {inc.parentAcknowledged ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 gap-1 text-[10px] font-bold rounded-xl">
                              <UserCheck className="w-3 h-3" /> Acknowledged
                            </Badge>
                          ) : inc.parentNotified ? (
                            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 text-[10px] font-bold rounded-xl">
                              Sent
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] font-bold rounded-xl">Pending</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-xl font-bold text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                              onClick={() => {
                                setSelectedIncident(inc);
                                setFollowUpStatus(inc.status);
                                setIsDetailOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1.5" />
                              Details
                            </Button>
                            {userRole === 'school_admin' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={() => handleDeleteIncident(inc.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium">
                <span className="text-slate-400">
                  Showing page {page} of {totalPages} ({total} total records)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-xl font-bold text-xs"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-xl font-bold text-xs"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: ANALYTICS DASHBOARD */}
        <TabsContent value="analytics" className="space-y-6 mt-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Top Categories Card */}
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6">
                <CardTitle className="text-sm md:text-base font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Incidents by Category
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">Breakdown of discipline types</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3 min-h-[160px] flex flex-col justify-center">
                {!analytics?.byCategory || analytics.byCategory.length === 0 ? (
                  <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/50">
                    <Sparkles className="w-6 h-6 text-slate-400 mx-auto opacity-40" />
                    <p className="text-xs text-slate-400 font-medium">No category breakdown data yet</p>
                  </div>
                ) : (
                  analytics.byCategory.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                        <span className="text-slate-400 font-mono">{item.value}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (item.value / (analytics?.total || 1)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Repeat Offenders Card */}
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6">
                <CardTitle className="text-sm md:text-base font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Repeated Incidents
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">Students requiring intervention</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3 min-h-[160px] flex flex-col justify-center">
                {!analytics?.repeatOffenders || analytics.repeatOffenders.length === 0 ? (
                  <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/50">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto opacity-50" />
                    <p className="text-xs text-slate-400 font-medium">No repeat offenders recorded</p>
                  </div>
                ) : (
                  analytics.repeatOffenders.map((item) => (
                    <div key={item.student.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">{item.student.fullName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">ID: {item.student.student_id}</p>
                      </div>
                      <Badge variant="destructive" className="font-bold rounded-xl text-[10px]">
                        {item.count} Incidents
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top Reporting Teachers Card */}
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <CardHeader className="p-6">
                <CardTitle className="text-sm md:text-base font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                  <User className="w-4 h-4 text-blue-500" />
                  Top Reporting Staff
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">Staff members reporting incidents</CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-3 min-h-[160px] flex flex-col justify-center">
                {!analytics?.topReporters || analytics.topReporters.length === 0 ? (
                  <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/50">
                    <User className="w-6 h-6 text-slate-400 mx-auto opacity-40" />
                    <p className="text-xs text-slate-400 font-medium">No staff reports logged yet</p>
                  </div>
                ) : (
                  analytics.topReporters.map((rep) => (
                    <div key={rep.name} className="flex items-center justify-between text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-slate-900 dark:text-white">{rep.name}</span>
                      <Badge variant="secondary" className="font-bold rounded-xl text-[10px]">{rep.count} reports</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trend Bar Chart Card */}
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/70 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Monthly Discipline Incident Trend
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">Incident distribution over time across months</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              {!analytics?.monthlyMap || Object.keys(analytics.monthlyMap).length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-slate-950/50">
                  <BarChart3 className="w-6 h-6 text-slate-400 mx-auto opacity-40" />
                  <p className="text-xs text-slate-400 font-medium">No monthly trend data logged yet</p>
                </div>
              ) : (
                <div className="flex items-end gap-3 h-48 pt-6 border-b border-slate-100 dark:border-slate-800 px-2 overflow-x-auto">
                  {Object.entries(analytics.monthlyMap).map(([month, count]) => {
                    const maxVal = Math.max(...Object.values(analytics.monthlyMap), 1);
                    const heightPct = Math.max(12, Math.round((count / maxVal) * 100));
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-2 group min-w-[40px]">
                        <span className="text-[10px] font-bold font-mono text-slate-400 group-hover:text-indigo-600">{count}</span>
                        <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-t-xl overflow-hidden flex items-end h-32">
                          <div
                            className="w-full bg-gradient-to-t from-indigo-600 to-violet-500 rounded-t-xl group-hover:from-indigo-500 group-hover:to-violet-400 transition-all duration-300"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{month}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CUSTOM CATEGORIES (Admin Only) */}
        {userRole === 'school_admin' && (
          <TabsContent value="categories" className="space-y-6 mt-6 focus-visible:outline-none">
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-100 dark:border-slate-800 rounded-3xl">
              <CardHeader className="p-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Discipline Categories</CardTitle>
                  <CardDescription className="text-xs font-medium">
                    Manage default and custom discipline categories for your school
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="rounded-2xl font-bold text-xs h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Category
                </Button>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {categories.map((cat) => (
                    <div
                      key={cat.id || cat.name}
                      className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 flex items-start justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-600" />
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{cat.name}</h4>
                        </div>
                        {cat.description && (
                          <p className="text-xs text-slate-500 font-medium mt-1">{cat.description}</p>
                        )}
                        <span className="inline-block mt-3 text-[9px] uppercase font-black tracking-wider text-slate-400">
                          {cat.isDefault ? 'Standard Default' : 'School Custom'}
                        </span>
                      </div>

                      {!cat.isDefault && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* CREATE INCIDENT MULTI-STEP WIZARD MODAL */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Reset wizard state on close
            setCreateStep(1);
            setStudentSearch('');
            setStudents([]);
            setPreviewStudent(null);
            setShowStudentResults(false);
            setStudentSearchSubmitted(false);
            setFormData({
              studentId: '',
              selectedStudentName: '',
              selectedStudentGrade: '',
              date: new Date().toISOString().split('T')[0],
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
              categoryName: 'Classroom Misbehavior',
              categoryId: '',
              severity: 'LOW',
              title: '',
              description: '',
              location: '',
              witnessesText: '',
              immediateAction: '',
              evidence: [],
              parentNotified: true,
              followUpDate: ''
            });
          }
          setIsCreateOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              <ShieldAlert className="w-6 h-6 text-indigo-600" />
              Report Discipline Incident (Step {createStep} of 5)
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              Follow the wizard to file an official discipline report and notify parents
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicator Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden my-3">
            <div
              className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(createStep / 5) * 100}%` }}
            />
          </div>

          {/* STEP 1: STUDENT SELECTION */}
          {createStep === 1 && (
            <div className="space-y-4 py-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Step 1: Search & Confirm Student</Label>

              {/* Search Row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Type student name or ID number..."
                    value={studentSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentSearch(val);
                      // Always clear stale results immediately — never show old data
                      setStudents([]);
                      if (previewStudent) setPreviewStudent(null);
                      if (!val.trim()) {
                        setShowStudentResults(false);
                        setStudentSearchSubmitted(false);
                      } else {
                        setShowStudentResults(true);
                        setStudentSearchSubmitted(true);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchStudents(studentSearch); }}}
                    className="pl-10 h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-semibold text-sm"
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => fetchStudents(studentSearch)}
                  disabled={!studentSearch.trim() || isLoadingStudents}
                  className="h-11 px-5 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs shrink-0"
                >
                  {isLoadingStudents ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Search Results Dropdown */}
              {showStudentResults && !previewStudent && (
                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  {isLoadingStudents ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Searching students...
                    </div>
                  ) : students.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <Search className="w-6 h-6 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">No students found for <span className="text-slate-600 dark:text-slate-300">"{studentSearch}"</span></p>
                      <p className="text-[11px] text-slate-400">Try a different name, or student ID number</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                      {students.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => {
                            setPreviewStudent(st);
                            setShowStudentResults(false);
                          }}
                          className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shrink-0 shadow">
                            <span className="text-sm font-black text-white">{(st.fullName || st.name || '?').charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{st.fullName || st.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              ID: {st.student_id} · {st.grade?.name || st.grade || ''} {st.section?.name || st.section || ''}
                              {(st.stream?.name || st.stream) ? ` · Stream ${st.stream?.name || st.stream}` : ''}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Full Student Profile Card (same layout as Student Management profile) */}
              {previewStudent && (
                <div className="border border-indigo-200 dark:border-indigo-800 rounded-3xl overflow-hidden shadow-lg">
                  {/* Profile Header */}
                  <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 pt-5 pb-4">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-t-3xl" />
                    <button
                      type="button"
                      onClick={() => { setPreviewStudent(null); setShowStudentResults(true); }}
                      className="absolute top-3.5 right-3.5 text-white/50 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3 pr-8">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
                        <span className="text-xl font-black text-white">{(previewStudent.fullName || previewStudent.name || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-white truncate">{previewStudent.fullName || previewStudent.name}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/50 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">Student</span>
                          <code className="text-[11px] font-mono text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-2 py-0.5 rounded-full">{previewStudent.student_id}</code>
                        </div>
                      </div>
                    </div>
                    {/* Quick chips */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {[
                        { label: previewStudent.grade?.name || previewStudent.grade || '—', sub: 'Grade' },
                        { label: previewStudent.section?.name || previewStudent.section || '—', sub: 'Section' },
                        { label: previewStudent.gender || '—', sub: 'Gender' },
                        ...((previewStudent.stream?.name || previewStudent.stream) ? [{ label: previewStudent.stream?.name || previewStudent.stream, sub: 'Stream' }] : []),
                      ].map((chip) => (
                        <div key={chip.sub} className="flex flex-col items-center bg-white/8 border border-white/10 rounded-xl px-3 py-1.5 min-w-[54px]">
                          <span className="text-[11px] font-black text-white/90 leading-none">{chip.label}</span>
                          <span className="text-[9px] font-bold uppercase text-white/40 tracking-widest mt-0.5">{chip.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Profile Body */}
                  <div className="bg-white dark:bg-slate-950 p-4 space-y-3">
                    {/* Student Details */}
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900">
                      {[
                        { icon: <Calendar className="w-3.5 h-3.5 opacity-50" />, label: 'Date of Birth', value: previewStudent.date_of_birth || 'Not set' },
                        ...(previewStudent.address ? [{ icon: <GraduationCap className="w-3.5 h-3.5 opacity-50" />, label: 'Address', value: previewStudent.address }] : []),
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between items-center px-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-900/40">
                          <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">{row.icon}{row.label}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[55%] truncate">{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Parent / Guardian */}
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-0.5 pt-1">Parent / Guardian</p>
                    <div className="rounded-2xl border border-slate-100 dark:border-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-900">
                      {[
                        { icon: <Users className="w-3.5 h-3.5 opacity-50" />, label: 'Name', value: previewStudent.parent_name },
                        { icon: <Phone className="w-3.5 h-3.5 opacity-50" />, label: 'Phone', value: previewStudent.parent_phone },
                        { icon: <Mail className="w-3.5 h-3.5 opacity-50" />, label: 'Email', value: previewStudent.parent_email || 'No email' },
                        { icon: <ShieldCheck className="w-3.5 h-3.5 opacity-50" />, label: 'Relationship', value: previewStudent.relationshipType || 'Guardian' },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between items-center px-3.5 py-2.5 bg-slate-50/60 dark:bg-slate-900/40">
                          <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">{row.icon}{row.label}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[55%] truncate">{row.value || 'N/A'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Confirm Button */}
                    <Button
                      type="button"
                      onClick={() => {
                        const st = previewStudent;
                        setFormData((prev) => ({
                          ...prev,
                          studentId: st.id,
                          selectedStudentName: st.fullName || st.name,
                          selectedStudentGrade: `${st.grade?.name || st.grade || ''} – ${st.section?.name || st.section || ''}${(st.stream?.name || st.stream) ? ` · Stream ${st.stream?.name || st.stream}` : ''}`
                        }));
                        setCreateStep(2);
                      }}
                      className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm – Use This Student
                    </Button>
                  </div>
                </div>
              )}

              {/* No search yet - idle hint */}
              {!showStudentResults && !previewStudent && (
                <div className="py-8 text-center space-y-2">
                  <Search className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Search by student name or ID to begin</p>
                  <p className="text-[11px] text-slate-400">e.g. "Abel Tesfaye" or "STU-2024-001"</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: INCIDENT DETAILS */}
          {createStep === 2 && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-xs border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">Selected Student</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">{formData.selectedStudentName}</span> ({formData.selectedStudentGrade})
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Time</Label>
                  <Input
                    type="text"
                    placeholder="e.g. 10:25 AM"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Category</Label>
                  <Select
                    value={formData.categoryName}
                    onValueChange={(val) => {
                      const activeCats = categories.length > 0 ? categories : DEFAULT_FALLBACK_CATEGORIES;
                      const matched = activeCats.find((c) => c.name === val);
                      setFormData({
                        ...formData,
                        categoryName: val,
                        categoryId: matched?.id || ''
                      });
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.length > 0 ? categories : DEFAULT_FALLBACK_CATEGORIES).map((c) => (
                        <SelectItem key={c.id || c.name} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Severity Level</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(val: any) => setFormData({ ...formData, severity: val })}
                  >
                    <SelectTrigger className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm">
                      <SelectValue placeholder="Select Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low (Green)</SelectItem>
                      <SelectItem value="MEDIUM">Medium (Orange)</SelectItem>
                      <SelectItem value="HIGH">High (Red)</SelectItem>
                      <SelectItem value="CRITICAL">Critical (Dark Red)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Incident Title *</Label>
                <Input
                  placeholder="e.g. Disrespectful behavior towards teacher during class"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Detailed Description *</Label>
                <Textarea
                  placeholder="Provide complete facts, student statements, and observation context..."
                  className="min-h-[120px] rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Incident Location</Label>
                  <Input
                    placeholder="e.g. Science Lab B"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Witnesses (comma separated)</Label>
                  <Input
                    placeholder="e.g. Mr. Abebe, Sara T."
                    value={formData.witnessesText}
                    onChange={(e) => setFormData({ ...formData, witnessesText: e.target.value })}
                    className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EVIDENCE ATTACHMENTS */}
          {createStep === 3 && (
            <div className="space-y-4 py-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Attach Evidence Files</Label>
              <p className="text-xs text-slate-400 font-medium">
                Upload photos of physical evidence, handwritten notes, or PDF records.
              </p>

              <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,video/*,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="evidence-upload-input"
                />
                <label htmlFor="evidence-upload-input" className="cursor-pointer">
                  <Paperclip className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Click to upload evidence files</p>
                  <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, PDF, MP4 up to 50MB</p>
                </label>
              </div>

              {isUploading && <p className="text-xs font-bold text-indigo-600 animate-pulse text-center">Attaching files...</p>}

              {formData.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Attached Files ({formData.evidence.length})</h4>
                  <div className="space-y-2">
                    {formData.evidence.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="truncate font-bold text-slate-900 dark:text-white">{file.name}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 h-8 w-8"
                          onClick={() => handleRemoveEvidence(idx)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Immediate Action Taken</Label>
                <Input
                  placeholder="e.g. Student sent to homeroom counselor / temporary removal from lab"
                  value={formData.immediateAction}
                  onChange={(e) => setFormData({ ...formData, immediateAction: e.target.value })}
                  className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 4: PARENT NOTIFICATION */}
          {createStep === 4 && (
            <div className="space-y-4 py-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Step 4: Parent Notification Options</Label>

              <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="notify-parent-check"
                    checked={formData.parentNotified}
                    onCheckedChange={(checked) => setFormData({ ...formData, parentNotified: Boolean(checked) })}
                    className="mt-1 rounded-lg"
                  />
                  <div>
                    <label htmlFor="notify-parent-check" className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer">
                      Send Instant Push & Portal Notification to Linked Parent
                    </label>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Parents will receive a push notification on Zetime Parent app detailing this report and will be prompted to acknowledge receipt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Scheduled Follow-up Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                />
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & SAVE */}
          {createStep === 5 && (
            <div className="space-y-4 py-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
                Step 5: Review & Save Incident Report
              </h3>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                    <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Student</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formData.selectedStudentName}</span>
                  </div>
                  <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                    <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Severity</span>
                    {getSeverityBadge(formData.severity)}
                  </div>
                  <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                    <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Category</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formData.categoryName}</span>
                  </div>
                  <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                    <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Date & Time</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formData.date} at {formData.time}</span>
                  </div>
                </div>

                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Title</span>
                  <p className="text-slate-900 dark:text-white font-bold">{formData.title}</p>
                </div>

                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Description</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{formData.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dialog Navigation Buttons */}
          <DialogFooter className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            {createStep > 1 ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (createStep === 2) {
                    // Going back to Step 1 – restore search + preview
                    setPreviewStudent(null);
                    setShowStudentResults(students.length > 0);
                    setFormData((p) => ({ ...p, studentId: '', selectedStudentName: '', selectedStudentGrade: '' }));
                  }
                  setCreateStep((s) => s - 1);
                }}
                className="rounded-2xl font-bold text-xs h-11 px-5"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : <div />}

            {/* Step 1 has no Next – confirmation is handled by the card button */}
            {createStep > 1 && createStep < 5 ? (
              <Button
                onClick={() => {
                  if (createStep === 2 && (!formData.title || !formData.description)) {
                    toast.error('Please provide a title and description');
                    return;
                  }
                  setCreateStep((s) => s + 1);
                }}
                className="rounded-2xl font-bold text-xs h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : createStep === 5 ? (
              <Button
                onClick={handleCreateIncidentSubmit}
                disabled={isSubmittingIncident}
                className="rounded-2xl font-bold text-xs h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-75 disabled:cursor-not-allowed min-w-[180px]"
              >
                {isSubmittingIncident ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Submitting Report...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Submit Incident Report
                  </>
                )}
              </Button>
            ) : <div />}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INCIDENT DETAIL DRAWER / MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
          {selectedIncident && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(selectedIncident.severity)}
                    {getStatusBadge(selectedIncident.status)}
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    ID: {selectedIncident.id.slice(0, 8)}
                  </span>
                </div>
                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mt-2">
                  {selectedIncident.title}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-slate-500">
                  Reported by <span className="font-bold text-slate-900 dark:text-slate-100">{selectedIncident.reportedByName || 'Staff'}</span> on {formatDate(selectedIncident.date)} at {selectedIncident.time}
                </DialogDescription>
              </DialogHeader>

              {/* Status Update Quick Bar (Admin / Teacher) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider">Change Status:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={selectedIncident.status === 'OPEN' ? 'default' : 'outline'}
                    onClick={() => handleStatusChange('OPEN')}
                    className="rounded-xl font-bold text-xs h-8"
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedIncident.status === 'UNDER_REVIEW' ? 'default' : 'outline'}
                    onClick={() => handleStatusChange('UNDER_REVIEW')}
                    className="rounded-xl font-bold text-xs h-8"
                  >
                    Under Review
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedIncident.status === 'RESOLVED' ? 'default' : 'outline'}
                    onClick={() => handleStatusChange('RESOLVED')}
                    className="rounded-xl font-bold text-xs h-8"
                  >
                    Resolved
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedIncident.status === 'CLOSED' ? 'default' : 'outline'}
                    onClick={() => handleStatusChange('CLOSED')}
                    className="rounded-xl font-bold text-xs h-8"
                  >
                    Closed
                  </Button>
                </div>
              </div>

              {/* Detailed Student & Incident Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Student</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.student?.fullName}</span>
                </div>
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Student ID</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedIncident.student?.student_id}</span>
                </div>
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Grade & Section</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.grade?.name} {selectedIncident.section?.name}</span>
                </div>
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Stream (11/12)</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.stream?.name || 'General / N/A'}</span>
                </div>
                <div className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                  <span className="text-slate-400 font-black uppercase text-[9px] block mb-1">Category</span>
                  <span className="font-bold text-indigo-600">{selectedIncident.categoryName}</span>
                </div>
              </div>

              {/* Description */}
              <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detailed Description</h4>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedIncident.description}
                </p>
              </div>

              {/* Actions & Immediate Response */}
              {selectedIncident.immediateAction && (
                <div className="p-4 border border-indigo-500/20 bg-indigo-500/10 rounded-2xl space-y-1">
                  <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300">Immediate Action Taken</h4>
                  <p className="text-xs text-indigo-800 dark:text-indigo-200 font-medium">{selectedIncident.immediateAction}</p>
                </div>
              )}

              {/* Evidence Attachments */}
              {selectedIncident.evidence && Array.isArray(selectedIncident.evidence) && selectedIncident.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Evidence Attachments ({selectedIncident.evidence.length})</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedIncident.evidence.map((att: any, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewAttachment(att)}
                        className="p-3.5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition-all flex items-center gap-2 text-xs"
                      >
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate font-bold text-slate-900 dark:text-white">{att.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parent Acknowledgement Status Box */}
              <div className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Parent Acknowledgement</span>
                  {selectedIncident.parentAcknowledged ? (
                    <Badge className="bg-emerald-600 text-white font-bold rounded-xl text-[10px]">Acknowledged</Badge>
                  ) : (
                    <Badge variant="outline" className="font-bold rounded-xl text-[10px]">Pending Parent Acknowledgment</Badge>
                  )}
                </div>

                {selectedIncident.parentAcknowledged && (
                  <div className="text-xs space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                    <p className="text-slate-400 font-medium">
                      Acknowledged on: {new Date(selectedIncident.parentAcknowledgedAt!).toLocaleString()}
                    </p>
                    {selectedIncident.parentAcknowledgementNotes && (
                      <p className="italic text-slate-800 dark:text-slate-200 font-medium">
                        &quot;{selectedIncident.parentAcknowledgementNotes}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Follow-up Timeline & New Entry */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Follow-up History & Actions</h4>

                {selectedIncident.followUps && selectedIncident.followUps.length > 0 && (
                  <div className="space-y-3 max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl p-4 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
                    {selectedIncident.followUps.map((fu) => (
                      <div key={fu.id} className="pt-3 first:pt-0 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-slate-900 dark:text-white">{fu.authorName || 'Staff'}</span>
                          <span className="text-slate-400 text-[10px]">{new Date(fu.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{fu.note}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Follow-up Form */}
                <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 space-y-3">
                  <Textarea
                    placeholder="Add follow-up note or resolution details..."
                    className="min-h-[70px] rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-medium"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <Select value={followUpStatus} onValueChange={(v) => setFollowUpStatus(v)}>
                      <SelectTrigger className="w-[160px] h-9 text-xs rounded-xl font-bold bg-white dark:bg-slate-950">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Keep Open</SelectItem>
                        <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                        <SelectItem value="RESOLVED">Set Resolved</SelectItem>
                        <SelectItem value="CLOSED">Set Closed</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      onClick={handleAddFollowUpSubmit}
                      disabled={isSubmittingFollowUp || !followUpNote.trim()}
                      className="rounded-xl font-bold text-xs h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Add Note
                    </Button>
                  </div>
                </div>
              </div>

              {/* System Audit Log History */}
              {selectedIncident.auditLogs && selectedIncident.auditLogs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Audit Trail ({selectedIncident.auditLogs.length})</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-950/50">
                    {selectedIncident.auditLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{log.action}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CATEGORY MANAGEMENT MODAL */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Add Custom Discipline Category
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              Create a custom discipline classification for your school
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Category Name *</Label>
              <Input
                placeholder="e.g. Lab Safety Violation"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Description (Optional)</Label>
              <Input
                placeholder="Short description..."
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)} className="rounded-2xl font-bold text-xs h-11 px-5">
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} className="rounded-2xl font-bold text-xs h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EVIDENCE PREVIEW MODAL */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-2xl rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">{previewAttachment?.name}</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {previewAttachment?.type?.startsWith('image/') ? (
              <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[60vh] mx-auto rounded-2xl object-contain shadow-lg" />
            ) : previewAttachment?.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-h-[60vh] w-full rounded-2xl shadow-lg" />
            ) : (
              <iframe src={previewAttachment?.url} className="w-full h-[60vh] rounded-2xl border border-slate-100 dark:border-slate-800" title={previewAttachment?.name} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
