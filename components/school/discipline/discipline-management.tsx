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
  Scale,
  UserPlus,
  FileCheck,
  History,
  Info,
  Lock,
  Sliders,
  CheckSquare
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
import { useCalendar } from '@/lib/context/calendar-context';
import { DualDatePicker } from '@/components/ui/dual-date-picker';

import {
  DisciplineApi,
  StudentDiscipline,
  DisciplineCategory,
  DisciplineActionConfig,
  DisciplineAnalytics,
  StudentDisciplineProfile
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

const DEFAULT_FALLBACK_ACTIONS: DisciplineActionConfig[] = [
  'Verbal Warning',
  'Written Warning',
  'Parent Conference',
  'Counseling Session',
  'Restorative Task',
  'Behavioral Plan',
  'Detention',
  'In-School Suspension',
  'Out-of-School Suspension',
  'Behavior Contract',
  'Other Action'
].map((name) => ({ id: name, schoolId: '', name, isDefault: true }));

interface DisciplineManagementProps {
  userRole?: 'school_admin' | 'teacher' | 'super_admin' | 'discipline_officer';
  initialTab?: 'incidents' | 'analytics' | 'categories' | 'actions';
  hideTabsList?: boolean;
}

export function DisciplineManagement({ userRole = 'school_admin', initialTab = 'incidents', hideTabsList = false }: DisciplineManagementProps) {
  const { formatDate } = useCalendar();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incidents' | 'analytics' | 'categories' | 'actions'>(initialTab);

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
  const [actionConfigs, setActionConfigs] = useState<DisciplineActionConfig[]>(DEFAULT_FALLBACK_ACTIONS);

  // Filter States
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [repeatSearch, setRepeatSearch] = useState('');

  // Refs for stable callbacks
  const pageRef = useRef(page);
  const searchRef = useRef(search);
  const severityFilterRef = useRef(severityFilter);
  const statusFilterRef = useRef(statusFilter);
  const categoryFilterRef = useRef(categoryFilter);
  const startDateFilterRef = useRef(startDateFilter);
  const endDateFilterRef = useRef(endDateFilter);

  // Student Profile View State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentDisciplineProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profilePage, setProfilePage] = useState(1);

  // Student Search List for Wizard
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);
  const [showStudentResults, setShowStudentResults] = useState(false);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [selectedIncident, setSelectedIncident] = useState<StudentDiscipline | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'incident' | 'action' | 'communication' | 'followup' | 'audit'>('incident');

  // Configuration Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  const [isActionConfigModalOpen, setIsActionConfigModalOpen] = useState(false);
  const [newActionConfigName, setNewActionConfigName] = useState('');
  const [newActionConfigDesc, setNewActionConfigDesc] = useState('');

  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  // Detail Modal Editable States
  const [recommendedAction, setRecommendedAction] = useState('');
  const [approvedAction, setApprovedAction] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [responsibleStaffName, setResponsibleStaffName] = useState('');
  const [actionStatus, setActionStatus] = useState('PENDING');
  const [isSavingAction, setIsSavingAction] = useState(false);

  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpActionTaken, setFollowUpActionTaken] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<string>('NO_CHANGE');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  // Incident Wizard Form State
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
    followUpDate: '',
    assignedToId: '' /* kept for backend compatibility but not shown in UI */
  });

  const [isUploading, setIsUploading] = useState(false);

  // Sync refs
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { searchRef.current = search; }, [search]);
  useEffect(() => { severityFilterRef.current = severityFilter; }, [severityFilter]);
  useEffect(() => { statusFilterRef.current = statusFilter; }, [statusFilter]);
  useEffect(() => { categoryFilterRef.current = categoryFilter; }, [categoryFilter]);
  useEffect(() => { startDateFilterRef.current = startDateFilter; }, [startDateFilter]);
  useEffect(() => { endDateFilterRef.current = endDateFilter; }, [endDateFilter]);

  const fetchIncidentsStable = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    try {
      const res = await DisciplineApi.getIncidents({
        page: pageRef.current,
        limit: 15,
        search: searchRef.current,
        severity: severityFilterRef.current === 'ALL' ? undefined : severityFilterRef.current,
        status: statusFilterRef.current === 'ALL' ? undefined : statusFilterRef.current,
        categoryName: categoryFilterRef.current === 'ALL' ? undefined : categoryFilterRef.current,
        assignedToMe: false,
        startDate: startDateFilterRef.current || undefined,
        endDate: endDateFilterRef.current || undefined
      });
      setIncidents(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      if (!isSilent) {
        toast.error(err.message || 'Failed to load discipline records');
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  }, []);

  const fetchIncidents = fetchIncidentsStable;

  const fetchAnalyticsAndConfigs = async () => {
    try {
      const [ana, cats, acts] = await Promise.all([
        DisciplineApi.getAnalytics().catch(() => null),
        DisciplineApi.getCategories().catch(() => []),
        DisciplineApi.getActionsConfig().catch(() => [])
      ]);
      if (ana) setAnalytics(ana);
      if (cats && Array.isArray(cats) && cats.length > 0) setCategories(cats);
      if (acts && Array.isArray(acts) && acts.length > 0) setActionConfigs(acts);
    } catch (err) {
      console.error('Error fetching analytics/configs:', err);
    }
  };

  // Debounced search & filter trigger (Silent if data already loaded)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIncidentsStable(incidents.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [page, search, severityFilter, statusFilter, categoryFilter, startDateFilter, endDateFilter, fetchIncidentsStable, incidents.length]);

  // Silent Background Polling & Event Listener
  useEffect(() => {
    fetchAnalyticsAndConfigs();

    const handleDisciplineChanged = () => {
      fetchIncidentsStable(true);
      fetchAnalyticsAndConfigs();
    };

    window.addEventListener('disciplineDataChanged', handleDisciplineChanged);
    const pollInterval = setInterval(() => {
      fetchIncidentsStable(true);
      fetchAnalyticsAndConfigs();
    }, 30_000);

    return () => {
      window.removeEventListener('disciplineDataChanged', handleDisciplineChanged);
      clearInterval(pollInterval);
    };
  }, [fetchIncidentsStable]);


  // Student Discipline Profile Fetcher
  const loadStudentProfile = async (studentId: string, pPage = 1) => {
    setIsLoadingProfile(true);
    setSelectedStudentId(studentId);
    setProfilePage(pPage);
    try {
      const data = await DisciplineApi.getStudentProfile(studentId, { page: pPage, limit: 10 });
      setStudentProfile(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load student discipline profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setTimeout(() => fetchIncidentsStable(), 0);
  };

  // Student search for wizard
  const fetchStudents = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setStudents([]);
    setIsLoadingStudents(true);
    setShowStudentResults(true);

    try {
      const token = localStorage.getItem('attendance_token');
      const schoolId = localStorage.getItem('x-school-id');
      const apiUrl = getApiUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (schoolId) headers['x-school-id'] = schoolId;

      const res = await fetch(`${apiUrl}/api/students?status=ACTIVE&search=${encodeURIComponent(trimmed)}&limit=20`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const rawList: any[] = data.students || data.data || [];

      const lowerQ = trimmed.toLowerCase();
      const filtered = rawList.filter((s) => {
        const name = (s.fullName || s.name || '').toLowerCase();
        const id = (s.student_id || '').toLowerCase();
        return name.includes(lowerQ) || id.includes(lowerQ);
      });

      setStudents(filtered);
    } catch (err) {
      console.error('Error loading students:', err);
    } fontFinally: {
      setIsLoadingStudents(false);
    }
  };

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
          toast.success(`${files.length} file(s) attached as evidence`);
        }
      };
      reader.readAsDataURL(file);
    });
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
        followUpDate: formData.followUpDate || undefined,
        assignedToId: formData.assignedToId || undefined
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
        followUpDate: '',
        assignedToId: ''
      });

      fetchIncidents();
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save incident');
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  // Open Detailed Modal & Sync States
  const handleOpenDetailModal = (inc: StudentDiscipline) => {
    setSelectedIncident(inc);
    setDetailTab('incident');
    setRecommendedAction(inc.recommendedAction || '');
    setApprovedAction(inc.approvedAction || '');
    setActionDate(inc.actionDate ? inc.actionDate.split('T')[0] : '');
    setResponsibleStaffName(inc.responsibleStaffName || '');
    setActionStatus(inc.actionStatus || 'PENDING');
    setFollowUpNote('');
    setFollowUpActionTaken('');
    setFollowUpStatus(inc.status);
    setIsDetailOpen(true);
  };

  const handleSaveActionSubmit = async () => {
    if (!selectedIncident) return;
    setIsSavingAction(true);
    try {
      const updated = await DisciplineApi.updateAction(selectedIncident.id, {
        recommendedAction,
        approvedAction,
        actionDate: actionDate || undefined,
        responsibleStaffName,
        actionStatus
      });
      setSelectedIncident(updated);
      toast.success('Disciplinary action plan saved');
      fetchIncidents();
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save action plan');
    } finally {
      setIsSavingAction(false);
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
        actionTaken: followUpActionTaken || undefined,
        status: followUpStatus || undefined
      });

      toast.success('Follow-up note added');
      setFollowUpNote('');
      setFollowUpActionTaken('');

      const updated = await DisciplineApi.getIncidentById(selectedIncident.id);
      setSelectedIncident(updated);
      fetchIncidents();
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add follow-up');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const handleStatusChange = async (newStatus: 'OPEN' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED') => {
    if (!selectedIncident) return;
    try {
      const updated = await DisciplineApi.updateIncident(selectedIncident.id, {
        status: newStatus,
        notifyParent: true
      });
      setSelectedIncident(updated);
      toast.success(`Case status updated to ${newStatus}`);
      fetchIncidents();
      fetchAnalyticsAndConfigs();
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
      fetchAnalyticsAndConfigs();
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
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await DisciplineApi.deleteCategory(id);
      toast.success('Category deleted');
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const handleCreateActionConfig = async () => {
    if (!newActionConfigName.trim()) return;
    try {
      await DisciplineApi.createActionConfig(newActionConfigName, newActionConfigDesc);
      toast.success('Disciplinary action added');
      setNewActionConfigName('');
      setNewActionConfigDesc('');
      setIsActionConfigModalOpen(false);
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create action configuration');
    }
  };

  const handleDeleteActionConfig = async (id: string) => {
    try {
      await DisciplineApi.deleteActionConfig(id);
      toast.success('Disciplinary action deleted');
      fetchAnalyticsAndConfigs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete action configuration');
    }
  };

  const exportToCSV = () => {
    if (incidents.length === 0) {
      toast.error('No records to export');
      return;
    }
    const headers = ['Case #', 'Student ID', 'Student Name', 'Grade', 'Section', 'Date', 'Time', 'Category', 'Severity', 'Status', 'Assigned Officer', 'Reporter', 'Parent Acknowledged'];
    const rows = incidents.map(inc => [
      `"${inc.caseNumber || inc.id.slice(0, 8)}"`,
      `"${inc.student?.student_id || ''}"`,
      `"${inc.student?.fullName || ''}"`,
      `"${inc.grade?.name || ''}"`,
      `"${inc.section?.name || ''}"`,
      `"${new Date(inc.date).toLocaleDateString()}"`,
      `"${inc.time || ''}"`,
      `"${inc.categoryName}"`,
      `"${inc.severity}"`,
      `"${inc.status}"`,
      `"${inc.assignedToName || 'Unassigned'}"`,
      `"${inc.reportedByName || ''}"`,
      `"${inc.parentAcknowledged ? 'Yes' : 'No'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SmartSchool_Discipline_Cases_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Discipline records exported to CSV');
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
      case 'INVESTIGATION':
        return <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400">Investigation</Badge>;
      case 'ACTION_REQUIRED':
        return <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400">Action Required</Badge>;
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
      {/* Top Header Card / Hero Banner - Displayed on Discipline Officer Portal Dashboard only */}
      {userRole === 'discipline_officer' && activeTab === 'analytics' && (
        <div className="relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-950 via-indigo-950/50 to-slate-900 p-6 md:p-8 rounded-3xl border border-indigo-500/20 shadow-2xl shadow-indigo-500/5 backdrop-blur-xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <div className="p-4 bg-indigo-500/15 text-indigo-400 rounded-2xl border border-indigo-500/30 shadow-inner flex-shrink-0">
              <Scale className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Student Discipline Case Management
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-100">{user?.name || 'Staff'}</span>
              </h1>
              <p className="text-xs md:text-sm font-medium text-slate-300 mt-1 max-w-2xl">
                Track student discipline cases, official disciplinary actions, follow-up timelines, and parent communications.
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
              className="rounded-2xl font-bold text-xs h-11 px-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 border-none transition-all transform hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Report Incident
            </Button>
          </div>
        </div>
      )}

      {/* STUDENT PROFILE OVERLAY VIEW */}
      {selectedStudentId && studentProfile && (
        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-indigo-500/30 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                {studentProfile.student.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{studentProfile.student.fullName}</h2>
                <p className="text-xs text-slate-400 font-medium">
                  ID: <span className="font-mono">{studentProfile.student.student_id}</span> · {studentProfile.student.grade} - {studentProfile.student.section}
                  {studentProfile.student.stream ? ` · Stream ${studentProfile.student.stream}` : ''}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedStudentId(null); setStudentProfile(null); }}
              className="rounded-2xl font-bold text-xs"
            >
              <X className="w-4 h-4 mr-1.5" />
              Close Profile View
            </Button>
          </div>

          {/* Neutral Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Cases</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{studentProfile.summaryStats.totalCases}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Open Cases</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{studentProfile.summaryStats.openCases}</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Under Review</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{studentProfile.summaryStats.underReviewCases}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Resolved Cases</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{studentProfile.summaryStats.resolvedCases}</p>
            </div>
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Follow-ups Due</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{studentProfile.summaryStats.followUpsDue}</p>
            </div>
          </div>

          {/* Chronological History Timeline */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Recorded Discipline Cases (Chronological History)</h3>
            {studentProfile.history.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No discipline cases on record for this student.</div>
            ) : (
              <div className="space-y-3">
                {studentProfile.history.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleOpenDetailModal(c)}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">Case #{c.caseNumber || c.id.slice(0, 8)}</span>
                        {getSeverityBadge(c.severity)}
                        {getStatusBadge(c.status)}
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{c.categoryName}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{c.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-1">{c.description}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-400 shrink-0">
                      <span>{new Date(c.date).toLocaleDateString()}</span>
                      <Button size="sm" variant="ghost" className="rounded-xl font-bold text-xs text-indigo-600">
                        View Case Details <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full space-y-6">
        {!hideTabsList && userRole !== 'discipline_officer' && (
          <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 inline-flex flex-wrap gap-1">
            <TabsTrigger value="incidents" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
              <ClipboardList className="w-4 h-4" />
              Discipline Cases Directory
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            {(userRole === 'school_admin' || userRole === 'super_admin' || userRole === 'discipline_officer') && (
              <>
                <TabsTrigger value="categories" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
                  <Tag className="w-4 h-4" />
                  Incident Categories
                </TabsTrigger>
                <TabsTrigger value="actions" className="rounded-xl font-bold text-xs h-9 px-4 gap-2">
                  <Sliders className="w-4 h-4" />
                  Disciplinary Actions
                </TabsTrigger>
              </>
            )}
          </TabsList>
        )}

        {/* TAB 1: INCIDENTS DIRECTORY */}
        <TabsContent value="incidents" className="space-y-6 mt-6 focus-visible:outline-none">
          {/* Header Banner & Description Note */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-500/20 shrink-0">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Discipline Cases Directory</h2>
                  <Badge variant="outline" className="font-bold text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                    Active Records
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  View, filter, and manage all student discipline cases, official disciplinary actions, follow-up logs, and parent notices.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="rounded-2xl font-bold text-xs h-10 px-4 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>

              <Button
                onClick={() => {
                  setCreateStep(1);
                  setIsCreateOpen(true);
                }}
                className="rounded-2xl font-bold text-xs h-10 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Report Incident
              </Button>
            </div>
          </div>

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
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Open / Review</p>
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
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Under Review</p>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {analytics?.underReviewCases || 0}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600">
                  <ClipboardList className="w-6 h-6" />
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

            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all col-span-2 md:col-span-1">
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
          </div>

          {/* Search & Filter Bar */}
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-100 dark:border-slate-800 rounded-3xl p-5">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search Case # (DC-2026-0001), student name, title, or reporter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 rounded-2xl text-sm font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val)}>
                  <SelectTrigger className="w-[130px] h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs">
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
                    <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
                  <SelectTrigger className="w-[160px] h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs">
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
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">No Discipline Cases Found</h3>
                <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                  There are no incidents matching your current search and filter criteria.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Case #</th>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Grade & Section</th>
                      <th className="px-6 py-4">Incident Title & Category</th>
                      <th className="px-6 py-4">Severity</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {incidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                          {inc.caseNumber || `DC-${inc.id.slice(0, 4).toUpperCase()}`}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          <div>
                            <p
                              onClick={() => loadStudentProfile(inc.studentId)}
                              className="font-bold text-slate-900 dark:text-white text-sm hover:text-indigo-600 cursor-pointer transition-colors"
                            >
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
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-xl font-bold text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                              onClick={() => handleOpenDetailModal(inc)}
                            >
                              <Eye className="w-4 h-4 mr-1.5" />
                              Case Details
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
          {/* Monthly Overview Bar Chart & Summary Card */}
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                  Monthly Incident Trends & Overview
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Distribution of logged discipline cases across months for the current academic year
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3.5 py-1.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  This Month: {analytics?.thisMonth || 0} Cases
                </div>
                <div className="px-3.5 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  Total Recorded: {analytics?.total || 0}
                </div>
              </div>
            </div>

            {/* Monthly Bars Visualization */}
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2 pt-2">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => {
                const count = analytics?.monthlyMap?.[m] || 0;
                const maxVal = Math.max(1, ...Object.values(analytics?.monthlyMap || { default: 1 }));
                const heightPercent = count > 0 ? Math.min(100, Math.max(15, (count / maxVal) * 100)) : 0;
                const isCurrentMonth = new Date().toLocaleString('default', { month: 'short' }) === m;

                return (
                  <div key={m} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 h-4">{count > 0 ? count : ''}</span>
                    <div className="w-full bg-slate-100 dark:bg-slate-800/60 h-28 rounded-2xl flex items-end p-1 relative group overflow-hidden">
                      <div
                        className={`w-full rounded-xl transition-all duration-500 ${isCurrentMonth
                            ? 'bg-gradient-to-t from-indigo-600 to-purple-500 shadow-md shadow-indigo-500/20'
                            : count > 0
                              ? 'bg-gradient-to-t from-indigo-400/80 to-purple-400/60 dark:from-indigo-600/80 dark:to-purple-600/60'
                              : 'bg-transparent'
                          }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${isCurrentMonth ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-500'}`}>
                      {m}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Large Data Analytics Grid: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CARD 1: Incidents by Category */}
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Incidents by Category
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Frequency breakdown of all recorded discipline categories
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-bold text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                    {analytics?.byCategory?.length || 0} Categories
                  </Badge>
                </div>

                {/* Filter Search Input for Categories */}
                <div className="relative mt-4">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search incident category..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-medium"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-4 space-y-3.5 max-h-[420px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const filteredCats = (analytics?.byCategory || []).filter(c =>
                    !categorySearch.trim() || c.name.toLowerCase().includes(categorySearch.toLowerCase())
                  );

                  if (filteredCats.length === 0) {
                    return (
                      <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50">
                        <Sparkles className="w-6 h-6 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-400">No categories found matching filter</p>
                      </div>
                    );
                  }

                  const totalCount = analytics?.total || 1;

                  return filteredCats.map((item, idx) => {
                    const pct = ((item.value / totalCount) * 100).toFixed(1);
                    return (
                      <div key={item.name} className="p-3 bg-slate-50/70 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between text-xs font-bold gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${idx === 0 ? 'bg-amber-500 text-white shadow-sm' :
                                idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' :
                                  idx === 2 ? 'bg-amber-700 text-white' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              }`}>
                              #{idx + 1}
                            </span>
                            <span className="text-slate-900 dark:text-white truncate">{item.name}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-mono">
                            <span className="text-slate-500 text-[11px] font-medium">({pct}%)</span>
                            <Badge className="font-bold text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                              {item.value} {item.value === 1 ? 'case' : 'cases'}
                            </Badge>
                          </div>
                        </div>

                        <div className="w-full bg-slate-200/60 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (item.value / totalCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>

            {/* CARD 2: Repeated Incidents (Students Requiring Intervention) */}
            <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Repeated Incidents (Student Interventions)
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Students with multiple recorded discipline offenses
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-bold text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                    {analytics?.repeatOffenders?.length || 0} Repeat Students
                  </Badge>
                </div>

                {/* Filter Search Input for Repeat Students */}
                <div className="relative mt-4">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search student by name or ID..."
                    value={repeatSearch}
                    onChange={(e) => setRepeatSearch(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-medium"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-4 space-y-2.5 max-h-[420px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const filteredOffenders = (analytics?.repeatOffenders || []).filter(item =>
                    !repeatSearch.trim() ||
                    item.student.fullName.toLowerCase().includes(repeatSearch.toLowerCase()) ||
                    item.student.student_id.toLowerCase().includes(repeatSearch.toLowerCase())
                  );

                  if (filteredOffenders.length === 0) {
                    return (
                      <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto opacity-60" />
                        <p className="text-xs font-bold text-slate-400">
                          {repeatSearch ? 'No repeat students match search filter' : 'No repeat incident offenders recorded'}
                        </p>
                      </div>
                    );
                  }

                  return filteredOffenders.map((item) => (
                    <div
                      key={item.student.id}
                      onClick={() => loadStudentProfile(item.student.id)}
                      className="p-3 bg-slate-50/70 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {item.student.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {item.student.fullName}
                          </h5>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            ID: {item.student.student_id} {item.student.grade ? `· ${item.student.grade}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="destructive" className="font-bold rounded-xl text-[10px] px-2.5 py-0.5 shadow-sm">
                          {item.count} Cases
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: CATEGORIES CONFIG */}
        <TabsContent value="categories" className="space-y-6 mt-6 focus-visible:outline-none">
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-100 dark:border-slate-800 rounded-3xl">
            <CardHeader className="p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Incident Categories</CardTitle>
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

        {/* TAB 4: DISCIPLINARY ACTIONS CONFIG */}
        <TabsContent value="actions" className="space-y-6 mt-6 focus-visible:outline-none">
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-100 dark:border-slate-800 rounded-3xl">
            <CardHeader className="p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Disciplinary Actions</CardTitle>
                <CardDescription className="text-xs font-medium">
                  Configure official disciplinary actions available for school policy enforcement
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsActionConfigModalOpen(true)}
                className="rounded-2xl font-bold text-xs h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Action
              </Button>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {actionConfigs.map((act) => (
                  <div
                    key={act.id || act.name}
                    className="p-5 border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-purple-600" />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{act.name}</h4>
                      </div>
                      {act.description && (
                        <p className="text-xs text-slate-500 font-medium mt-1">{act.description}</p>
                      )}
                      <span className="inline-block mt-3 text-[9px] uppercase font-black tracking-wider text-slate-400">
                        {act.isDefault ? 'Standard Default' : 'School Custom'}
                      </span>
                    </div>

                    {!act.isDefault && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        onClick={() => handleDeleteActionConfig(act.id)}
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
      </Tabs>

      {/* CREATE INCIDENT MULTI-STEP WIZARD MODAL */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateStep(1);
            setStudentSearch('');
            setStudents([]);
            setPreviewStudent(null);
            setShowStudentResults(false);
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
              followUpDate: '',
              assignedToId: ''
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

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Type student name or ID number..."
                    value={studentSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentSearch(val);
                      setStudents([]);
                      if (previewStudent) setPreviewStudent(null);
                      if (!val.trim()) {
                        setShowStudentResults(false);
                      } else {
                        setShowStudentResults(true);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchStudents(studentSearch); } }}
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
                      <p className="text-xs font-bold text-slate-400">No students found for <span className="text-slate-600 dark:text-slate-300">&quot;{studentSearch}&quot;</span></p>
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
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {previewStudent && (
                <div className="border border-indigo-200 dark:border-indigo-800 rounded-3xl overflow-hidden shadow-lg p-4 space-y-3 bg-white dark:bg-slate-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                        {(previewStudent.fullName || previewStudent.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">{previewStudent.fullName || previewStudent.name}</h3>
                        <p className="text-xs text-slate-400 font-mono">ID: {previewStudent.student_id}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setPreviewStudent(null); setShowStudentResults(true); }}>
                      Change
                    </Button>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      const st = previewStudent;
                      setFormData((prev) => ({
                        ...prev,
                        studentId: st.id,
                        selectedStudentName: st.fullName || st.name,
                        selectedStudentGrade: `${st.grade?.name || st.grade || ''} – ${st.section?.name || st.section || ''}`
                      }));
                      setCreateStep(2);
                    }}
                    className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm – Use This Student
                  </Button>
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
                  <DualDatePicker
                    value={formData.date}
                    onChange={(val) => setFormData({ ...formData, date: val })}
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
                      const matched = categories.find((c) => c.name === val);
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
                      {categories.map((c) => (
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
                  placeholder="e.g. Classroom disruption during math test"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-11 rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Detailed Description *</Label>
                <Textarea
                  placeholder="Provide complete facts, student statements, and observation context..."
                  className="min-h-[100px] rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm font-medium"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* STEP 3: EVIDENCE ATTACHMENTS */}
          {createStep === 3 && (
            <div className="space-y-4 py-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Attach Evidence Files</Label>

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
                </label>
              </div>

              {formData.evidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Attached Files ({formData.evidence.length})</h4>
                  {formData.evidence.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-2xl bg-white dark:bg-slate-950 text-xs font-bold">
                      <span>{file.name}</span>
                      <Button size="icon" variant="ghost" onClick={() => setFormData({ ...formData, evidence: formData.evidence.filter((_, i) => i !== idx) })}>
                        <X className="w-4 h-4 text-rose-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: PARENT NOTIFICATION */}
          {createStep === 4 && (
            <div className="space-y-4 py-2">

              <div className="p-4 border rounded-3xl bg-white dark:bg-slate-950 space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="notify-parent-check"
                    checked={formData.parentNotified}
                    onCheckedChange={(checked) => setFormData({ ...formData, parentNotified: Boolean(checked) })}
                    className="rounded-lg"
                  />
                  <label htmlFor="notify-parent-check" className="text-sm font-bold cursor-pointer">
                    Send Instant Push & Portal Notification to Linked Parent
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & SAVE */}
          {createStep === 5 && (
            <div className="space-y-4 py-2 text-xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b pb-2">Review & Submit</h3>
              <div className="space-y-2">
                <p><strong>Student:</strong> {formData.selectedStudentName}</p>
                <p><strong>Title:</strong> {formData.title}</p>
                <p><strong>Category:</strong> {formData.categoryName}</p>
                <p><strong>Severity:</strong> {formData.severity}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-3 pt-4 border-t">
            {createStep > 1 && (
              <Button variant="outline" onClick={() => setCreateStep((s) => s - 1)} className="rounded-2xl font-bold text-xs h-11 px-5">
                Back
              </Button>
            )}
            {createStep < 5 ? (
              <Button onClick={() => setCreateStep((s) => s + 1)} className="rounded-2xl font-bold text-xs h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white">
                Next
              </Button>
            ) : (
              <Button onClick={handleCreateIncidentSubmit} disabled={isSubmittingIncident} className="rounded-2xl font-bold text-xs h-11 px-6 bg-emerald-600 text-white">
                Submit Case Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPGRADED 6-TAB CASE DETAILS MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-2xl p-6 md:p-8">
          {selectedIncident && (
            <div className="space-y-6">
              {/* Header */}
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                      Case #{selectedIncident.caseNumber || selectedIncident.id.slice(0, 8)}
                    </span>
                    {getSeverityBadge(selectedIncident.severity)}
                    {getStatusBadge(selectedIncident.status)}
                  </div>
                </div>
                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mt-2">
                  {selectedIncident.title}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-slate-500">
                  Student: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedIncident.student?.fullName}</span> (ID: {selectedIncident.student?.student_id}) · Reported by {selectedIncident.reportedByName || 'Staff'} on {formatDate(selectedIncident.date)}
                </DialogDescription>
              </DialogHeader>

              {/* 5 Tabs Navigation */}
              <Tabs value={detailTab} onValueChange={(v: any) => setDetailTab(v)} className="w-full">
                <TabsList className="bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl w-full justify-start overflow-x-auto gap-1">
                  <TabsTrigger value="incident" className="rounded-xl text-xs font-bold h-9">Incident</TabsTrigger>
                  <TabsTrigger value="action" className="rounded-xl text-xs font-bold h-9">Disciplinary Actions</TabsTrigger>
                  <TabsTrigger value="communication" className="rounded-xl text-xs font-bold h-9">Parent Notices</TabsTrigger>
                  <TabsTrigger value="followup" className="rounded-xl text-xs font-bold h-9">Follow-up Timeline</TabsTrigger>
                  {(userRole === 'school_admin' || userRole === 'super_admin' || userRole === 'discipline_officer') && (
                    <TabsTrigger value="audit" className="rounded-xl text-xs font-bold h-9">Audit History</TabsTrigger>
                  )}
                </TabsList>

                {/* TAB 1: INCIDENT */}
                <TabsContent value="incident" className="space-y-4 pt-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-2 border">
                    <h4 className="text-xs font-black uppercase text-slate-400">Incident Narrative</h4>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{selectedIncident.description}</p>
                  </div>
                  {selectedIncident.immediateAction && (
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 text-xs">
                      <h4 className="font-bold text-indigo-900 dark:text-indigo-300">Immediate Action Taken</h4>
                      <p className="text-indigo-800 dark:text-indigo-200 mt-1">{selectedIncident.immediateAction}</p>
                    </div>
                  )}
                  {/* Status Quick Change */}
                  <div className="p-4 border rounded-2xl bg-white dark:bg-slate-950 space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400">Update Case Status</Label>
                    <Select value={selectedIncident.status} onValueChange={(v: any) => handleStatusChange(v)}>
                      <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                        <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* TAB 2: DISCIPLINARY ACTIONS */}
                <TabsContent value="action" className="space-y-4 pt-4">
                  {/* Current Action Summary */}
                  {(selectedIncident.approvedAction || selectedIncident.actionStatus) && (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Current Approved Action</p>
                      <p className="text-base font-bold text-emerald-900 dark:text-emerald-200">{selectedIncident.approvedAction || '—'}</p>
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        {selectedIncident.actionStatus && (
                          <span className={`px-2.5 py-0.5 rounded-full font-bold border ${selectedIncident.actionStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                              selectedIncident.actionStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                                selectedIncident.actionStatus === 'APPROVED' ? 'bg-indigo-100 text-indigo-700 border-indigo-300' :
                                  'bg-amber-100 text-amber-700 border-amber-300'
                            }`}>{selectedIncident.actionStatus.replace('_', ' ')}</span>
                        )}
                        {selectedIncident.actionDate && (
                          <span className="text-slate-500">Action Date: <strong>{new Date(selectedIncident.actionDate).toLocaleDateString()}</strong></span>
                        )}
                        {selectedIncident.responsibleStaffName && (
                          <span className="text-slate-500">Responsible Staff: <strong>{selectedIncident.responsibleStaffName}</strong></span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Edit Action Form */}
                  <div className="space-y-3 p-4 border rounded-2xl bg-white dark:bg-slate-950">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Update Disciplinary Action</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-500">Approved Action</Label>
                        <Select value={approvedAction} onValueChange={(v) => setApprovedAction(v)}>
                          <SelectTrigger className="h-10 rounded-xl text-xs font-bold mt-1">
                            <SelectValue placeholder="Select Disciplinary Action" />
                          </SelectTrigger>
                          <SelectContent>
                            {actionConfigs.map((act) => (
                              <SelectItem key={act.id || act.name} value={act.name}>{act.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-500">Action Status</Label>
                        <Select value={actionStatus} onValueChange={(v) => setActionStatus(v)}>
                          <SelectTrigger className="h-10 rounded-xl text-xs font-bold mt-1">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="APPROVED">Approved</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-500">Action Date</Label>
                        <input
                          type="date"
                          value={actionDate}
                          onChange={(e) => setActionDate(e.target.value)}
                          className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-500">Responsible Staff</Label>
                        <input
                          type="text"
                          placeholder="Staff name..."
                          value={responsibleStaffName}
                          onChange={(e) => setResponsibleStaffName(e.target.value)}
                          className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <Button size="sm" onClick={handleSaveActionSubmit} disabled={isSavingAction} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-5 h-10">
                      {isSavingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                      Save Disciplinary Action
                    </Button>
                  </div>
                </TabsContent>

                {/* TAB 3: PARENT NOTICES */}
                <TabsContent value="communication" className="space-y-4 pt-4">
                  <div className="p-4 border rounded-2xl bg-white dark:bg-slate-950 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Parent Notification</p>
                      {selectedIncident.parentNotified ? (
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-300 font-bold text-[10px]">Notified</Badge>
                      ) : (
                        <Badge variant="outline" className="font-bold text-[10px]">Not Yet Notified</Badge>
                      )}
                    </div>
                    {selectedIncident.parentNotifiedAt && (
                      <p className="text-xs text-slate-500">Notification sent on: <strong>{new Date(selectedIncident.parentNotifiedAt).toLocaleDateString()}</strong></p>
                    )}
                    <div className="border-t pt-3">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Parent Acknowledgment</p>
                      {selectedIncident.parentAcknowledged ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-600 text-white font-bold">Acknowledged</Badge>
                          {selectedIncident.parentAcknowledgedAt && (
                            <span className="text-xs text-slate-400">on {new Date(selectedIncident.parentAcknowledgedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 font-bold">Pending Acknowledgment</Badge>
                      )}
                      {selectedIncident.parentAcknowledgementNotes && (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border text-xs">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Parent's Note</p>
                          <p className="italic text-slate-700 dark:text-slate-300">&quot;{selectedIncident.parentAcknowledgementNotes}&quot;</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 4: FOLLOW-UP TIMELINE */}
                <TabsContent value="followup" className="space-y-4 pt-4">
                  {/* Existing follow-ups visual timeline */}
                  {selectedIncident.followUps && selectedIncident.followUps.length > 0 ? (
                    <div className="relative pl-5 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-5">
                      {selectedIncident.followUps.slice().reverse().map((fu, idx) => (
                        <div key={fu.id} className="relative">
                          <div className="absolute -left-[1.625rem] w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{fu.authorName || 'Staff'}</span>
                                {fu.statusAfter && fu.statusBefore && fu.statusAfter !== fu.statusBefore && (
                                  <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full font-bold">
                                    {fu.statusBefore} → {fu.statusAfter}
                                  </span>
                                )}
                                {fu.actionTaken && (
                                  <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full font-bold">
                                    Action: {fu.actionTaken}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium shrink-0">
                                {new Date(fu.createdAt).toLocaleDateString()} {new Date(fu.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{fu.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <History className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">No follow-up entries yet</p>
                    </div>
                  )}
                  {/* Add new follow-up */}
                  <div className="p-4 border rounded-2xl bg-slate-50 dark:bg-slate-950 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Add Follow-up Entry</p>
                    <Textarea
                      placeholder="Describe the follow-up action, meeting outcome, or status update..."
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      className="min-h-[80px] text-xs rounded-xl bg-white dark:bg-slate-900"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Action taken (optional)"
                        value={followUpActionTaken}
                        onChange={(e) => setFollowUpActionTaken(e.target.value)}
                        className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium"
                      />
                      <Select value={followUpStatus} onValueChange={(v) => setFollowUpStatus(v)}>
                        <SelectTrigger className="w-40 h-9 rounded-xl text-xs font-bold">
                          <SelectValue placeholder="Change Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NO_CHANGE">No Status Change</SelectItem>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                          <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" onClick={handleAddFollowUpSubmit} disabled={isSubmittingFollowUp} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-5 h-10">
                      {isSubmittingFollowUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                      Submit Follow-up
                    </Button>
                  </div>
                </TabsContent>

                {/* TAB 5: AUDIT HISTORY */}
                <TabsContent value="audit" className="space-y-3 pt-4">
                  {selectedIncident.auditLogs && selectedIncident.auditLogs.length > 0 ? (
                    <div className="space-y-2">
                      {selectedIncident.auditLogs.map((log: any) => (
                        <div key={log.id} className="p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 space-y-1.5">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleDateString()} · {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {log.authorName && (
                            <p className="text-[10px] text-slate-500 pl-4">By: <span className="font-bold text-slate-700 dark:text-slate-300">{log.authorName}</span></p>
                          )}
                          {log.new_values && Object.keys(log.new_values).length > 0 && (
                            <div className="pl-4 flex flex-wrap gap-2">
                              {Object.entries(log.new_values).map(([k, v]: any) => (
                                v != null && String(v).trim() !== '' && (
                                  <span key={k} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg font-mono">
                                    {k}: {String(v)}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <History className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-400">No audit history available</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CATEGORY MODAL */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader><DialogTitle>Add Custom Category</DialogTitle></DialogHeader>
          <Input placeholder="Category Name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="h-11 rounded-2xl" />
          <DialogFooter><Button onClick={handleCreateCategory}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ACTION CONFIG MODAL */}
      <Dialog open={isActionConfigModalOpen} onOpenChange={setIsActionConfigModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader><DialogTitle>Add Custom Disciplinary Action</DialogTitle></DialogHeader>
          <Input placeholder="Action Name (e.g. Detention)" value={newActionConfigName} onChange={(e) => setNewActionConfigName(e.target.value)} className="h-11 rounded-2xl" />
          <DialogFooter><Button onClick={handleCreateActionConfig}>Save Action</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
