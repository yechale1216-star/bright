import { getApiUrl } from './api-config';
import { apiFetch } from './utils/fetch-with-timeout';

const API_URL = getApiUrl();

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  let userRole: string | null = null;
  try {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('attendance_current_user') : null;
    if (userStr) {
      const u = JSON.parse(userStr);
      userRole = u?.role || null;
    }
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (schoolId) {
    headers['x-school-id'] = schoolId;
  }
  if (userRole) {
    headers['x-requested-role'] = userRole;
  }

  return headers;
}

export interface GradingScale {
  id: string;
  grade: string;
  minScore: number;
  maxScore: number;
  gpaPoint?: number | null;
  description?: string | null;
  color?: string | null;
  isPassing: boolean;
}

export interface Exam {
  id: string;
  name: string;
  academicYearId: string;
  academicTermId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  isPublished: boolean;
  description?: string | null;
  academicYear?: { id: string; name: string };
  academicTerm?: { id: string; name: string } | null;
  _count?: { assessments: number };
}

export interface Assessment {
  id: string;
  examId?: string | null;
  academicYearId: string;
  academicTermId?: string | null;
  gradeId: string;
  sectionId?: string | null;
  subjectId: string;
  title: string;
  type: string;
  maxScore: number;
  weightage: number;
  passingScore?: number | null;
  date?: string | null;
  categoryId?: string | null;
  description?: string | null;
  subject?: { id: string; name: string; code: string; color: string };
  grade?: { id: string; name: string };
  section?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string };
  academicTerm?: { id: string; name: string } | null;
  exam?: { id: string; name: string; status: string } | null;
  _count?: { marks: number };
}

export interface StudentMarksRow {
  student: {
    id: string;
    student_id: string;
    fullName: string;
    gender?: string | null;
    grade?: { id: string; name: string };
    section?: { id: string; name: string };
  };
  markId?: string | null;
  score: number | null;
  isAbsent: boolean;
  remarks: string;
  updatedAt?: string | null;
}

export interface MarksSheetData {
  assessment: Assessment;
  rows: StudentMarksRow[];
  totalStudents: number;
  gradedStudents: number;
}

export interface ClassGradebookCategorySummary {
  id: string;
  name: string;
  weight: number;
  aggregationMethod: string;
  assessmentCount: number;
  averagePercentage: number;
}

export interface ClassGradebookScheme {
  id: string | null;
  name: string;
  aggregationMethod: string;
  categories: Array<{ id: string; name: string; weight: number; aggregationMethod?: string }>;
  categorySummaries: ClassGradebookCategorySummary[];
}

export interface ClassGradebookAssessment {
  id: string;
  title: string;
  type: string;
  maxScore: number;
  weightage: number;
  passingScore?: number | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryWeight?: number | null;
  date?: string | null;
  description?: string | null;
  status: string;
}

export interface ClassGradebookStudentRow {
  student: {
    id: string;
    student_id: string;
    fullName: string;
    gender?: string | null;
  };
  marks: Record<
    string,
    {
      markId: string | null;
      score: number | null;
      isAbsent: boolean;
      status: string;
      remarks: string | null;
      updatedAt?: string | null;
    }
  >;
  calculation: {
    studentId: string;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      weight: number;
      earnedMarks: number;
      maxMarks: number;
      percentage: number | null;
      weightedContribution: number;
      assessmentCount: number;
      assessedCount: number;
      isComplete: boolean;
      missingCount: number;
    }>;
    totalWeight: number;
    provisionalScore: number;
    finalScore: number | null;
    isComplete: boolean;
    missingAssessmentsCount: number;
    unenteredMarksCount: number;
  };
  isComplete: boolean;
}

export interface ClassGradebookData {
  scheme: ClassGradebookScheme;
  assessments: ClassGradebookAssessment[];
  students: ClassGradebookStudentRow[];
  submissionRecord: {
    id: string;
    status: string;
    notes?: string | null;
    rejectionReason?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    publishedAt?: string | null;
    reopenedAt?: string | null;
    reopenReason?: string | null;
    teacher?: { id: string; name: string; email: string } | null;
  } | null;
  statistics: {
    totalStudents: number;
    completedStudentsCount: number;
    missingMarksStudentsCount: number;
    absentStudentsCount: number;
    completionPercentage: number;
    classAverage: number;
    highestScore: number;
    lowestScore: number;
  };
}

export interface ReportCardSubjectScore {
  id: string;
  reportCardId: string;
  subjectId: string;
  score: number;
  maxScore: number;
  gradeLetter?: string | null;
  gpaPoint?: number | null;
  rank?: number | null;
  teacherRemarks?: string | null;
  subject?: { id: string; name: string; code: string };
}

export interface ReportCard {
  id: string;
  studentId: string;
  academicYearId: string;
  academicTermId: string;
  gradeId: string;
  sectionId: string;
  totalScore: number;
  maxPossibleScore: number;
  averageScore: number;
  gpa?: number | null;
  rank?: number | null;
  totalStudentsInClass?: number | null;
  attendancePresentDays: number;
  attendanceTotalDays: number;
  conduct?: string | null;
  homeroomTeacherComment?: string | null;
  principalComment?: string | null;
  status: string; // DRAFT | GENERATED | APPROVED | PUBLISHED
  publishedAt?: string | null;
  createdAt: string;
  student?: {
    id: string;
    student_id: string;
    fullName: string;
    gender?: string | null;
    parent_name?: string | null;
    parent_phone?: string | null;
    date_of_birth?: string | null;
  };
  grade?: { id: string; name: string };
  section?: { id: string; name: string };
  academicYear?: { id: string; name: string };
  academicTerm?: { id: string; name: string };
  subjectScores?: ReportCardSubjectScore[];
}

export interface ComprehensiveReportCardPeriod {
  id: string;
  label: string;
}

export interface ComprehensiveReportCardSubjectRow {
  subjectId: string;
  subjectName: string;
  code: string;
  weight: number;
  scores: Record<string, number>;
  total: number;
  average: number;
}

export interface ComprehensiveReportCardData {
  reportCardId: string;
  issueDate: string;
  school: {
    name: string;
    amharicName: string;
    address: string;
    phone: string;
    logo: string;
  };
  student: {
    id: string;
    studentId: string;
    fullName: string;
    gender: string;
    age: number;
    dateOfBirth?: string | null;
    photo?: string | null;
    status: string;
  };
  academic: {
    gradeId: string;
    gradeName: string;
    sectionId: string;
    sectionName: string;
    academicYearId: string;
    academicYearName: string;
    academicTermId: string;
    academicTermName: string;
    homeroomTeacherName: string;
  };
  periods: ComprehensiveReportCardPeriod[];
  subjectRows: ComprehensiveReportCardSubjectRow[];
  summary: {
    totalRow: {
      weight: number;
      periodSums: Record<string, number>;
      total: number;
      average: number;
    };
    averageRow: {
      periodAverages: Record<string, number>;
      overallAverage: number;
    };
    rank: string;
    conduct: string;
    absence: string;
    remarkBadge: string;
    teacherComment?: string;
    principalComment?: string;
  };
  qrCodeData: string;
  status: string;
}

export const gradebookService = {
  // Grading Scales
  async getGradingScales(): Promise<GradingScale[]> {
    const res = await apiFetch<{ success: boolean; data: GradingScale[] }>(
      `${API_URL}/api/gradebook/scales`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async createGradingScale(data: Partial<GradingScale>): Promise<GradingScale> {
    const res = await apiFetch<{ success: boolean; data: GradingScale }>(
      `${API_URL}/api/gradebook/scales`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateGradingScale(id: string, data: Partial<GradingScale>): Promise<GradingScale> {
    const res = await apiFetch<{ success: boolean; data: GradingScale }>(
      `${API_URL}/api/gradebook/scales/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async deleteGradingScale(id: string): Promise<void> {
    await apiFetch(`${API_URL}/api/gradebook/scales/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // Exams
  async getExams(filters: { academicYearId?: string; academicTermId?: string } = {}): Promise<Exam[]> {
    const query = new URLSearchParams();
    if (filters.academicYearId) query.set('academicYearId', filters.academicYearId);
    if (filters.academicTermId) query.set('academicTermId', filters.academicTermId);

    const res = await apiFetch<{ success: boolean; data: Exam[] }>(
      `${API_URL}/api/gradebook/exams?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async createExam(data: Partial<Exam>): Promise<Exam> {
    const res = await apiFetch<{ success: boolean; data: Exam }>(
      `${API_URL}/api/gradebook/exams`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateExam(id: string, data: Partial<Exam>): Promise<Exam> {
    const res = await apiFetch<{ success: boolean; data: Exam }>(
      `${API_URL}/api/gradebook/exams/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async deleteExam(id: string): Promise<void> {
    await apiFetch(`${API_URL}/api/gradebook/exams/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // Assessments
  async getAssessments(filters: {
    examId?: string;
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    academicYearId?: string;
    academicTermId?: string;
  } = {}): Promise<Assessment[]> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) query.set(k, v);
    });

    const res = await apiFetch<{ success: boolean; data: Assessment[] }>(
      `${API_URL}/api/gradebook/assessments?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async createAssessment(data: Partial<Assessment>): Promise<Assessment> {
    const res = await apiFetch<{ success: boolean; data: Assessment }>(
      `${API_URL}/api/gradebook/assessments`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateAssessment(id: string, data: Partial<Assessment>): Promise<Assessment> {
    const res = await apiFetch<{ success: boolean; data: Assessment }>(
      `${API_URL}/api/gradebook/assessments/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async deleteAssessment(id: string): Promise<void> {
    await apiFetch(`${API_URL}/api/gradebook/assessments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // Marks Sheet & Entry
  async getMarksSheet(assessmentId: string): Promise<MarksSheetData> {
    const res = await apiFetch<{ success: boolean; data: MarksSheetData }>(
      `${API_URL}/api/gradebook/assessments/${assessmentId}/marks-sheet`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async saveBulkMarks(
    assessmentId: string,
    marks: Array<{ studentId: string; score: number; isAbsent?: boolean; remarks?: string }>
  ): Promise<{ count: number }> {
    const res = await apiFetch<{ success: boolean; data: { count: number }; message: string }>(
      `${API_URL}/api/gradebook/marks/bulk`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ assessmentId, marks }),
      }
    );
    return res.data;
  },

  async getStudentMarks(studentId: string, academicYearId?: string, academicTermId?: string): Promise<any[]> {
    const query = new URLSearchParams();
    if (academicYearId) query.set('academicYearId', academicYearId);
    if (academicTermId) query.set('academicTermId', academicTermId);

    const res = await apiFetch<{ success: boolean; data: any[] }>(
      `${API_URL}/api/gradebook/students/${studentId}/marks?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  // Report Cards
  async generateReportCards(params: {
    gradeId: string;
    sectionId: string;
    academicYearId: string;
    academicTermId: string;
  }): Promise<{ count: number; message: string }> {
    const res = await apiFetch<{ success: boolean; data: { count: number }; message: string }>(
      `${API_URL}/api/gradebook/report-cards/generate`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      }
    );
    return { count: res.data.count, message: res.message };
  },

  async getReportCards(filters: {
    gradeId?: string;
    sectionId?: string;
    academicYearId?: string;
    academicTermId?: string;
    status?: string;
  } = {}): Promise<ReportCard[]> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) query.set(k, v);
    });

    const res = await apiFetch<{ success: boolean; data: ReportCard[] }>(
      `${API_URL}/api/gradebook/report-cards?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async getReportCardById(id: string): Promise<ReportCard> {
    const res = await apiFetch<{ success: boolean; data: ReportCard }>(
      `${API_URL}/api/gradebook/report-cards/${id}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async updateReportCard(
    id: string,
    data: {
      homeroomTeacherComment?: string;
      principalComment?: string;
      conduct?: string;
      status?: string;
    }
  ): Promise<ReportCard> {
    const res = await apiFetch<{ success: boolean; data: ReportCard }>(
      `${API_URL}/api/gradebook/report-cards/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async bulkUpdateReportCardStatus(ids: string[], status: string): Promise<void> {
    await apiFetch(`${API_URL}/api/gradebook/report-cards/bulk-status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids, status }),
    });
  },

  async getStudentReportCards(
    studentId: string,
    academicTermId?: string,
    academicYearId?: string
  ): Promise<ReportCard[]> {
    const query = new URLSearchParams();
    if (academicTermId) query.set('academicTermId', academicTermId);
    if (academicYearId) query.set('academicYearId', academicYearId);

    const res = await apiFetch<{ success: boolean; data: ReportCard[] }>(
      `${API_URL}/api/gradebook/students/${studentId}/report-cards?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async getComprehensiveReportCard(
    studentId: string,
    academicYearId?: string,
    academicTermId?: string
  ): Promise<ComprehensiveReportCardData> {
    const query = new URLSearchParams();
    query.set('studentId', studentId);
    if (academicYearId) query.set('academicYearId', academicYearId);
    if (academicTermId) query.set('academicTermId', academicTermId);

    const res = await apiFetch<{ success: boolean; data: ComprehensiveReportCardData }>(
      `${API_URL}/api/gradebook/report-cards/comprehensive?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async getBatchComprehensiveReportCards(params: {
    gradeId: string;
    sectionId: string;
    academicYearId?: string;
    academicTermId?: string;
  }): Promise<ComprehensiveReportCardData[]> {
    const query = new URLSearchParams();
    query.set('gradeId', params.gradeId);
    query.set('sectionId', params.sectionId);
    if (params.academicYearId) query.set('academicYearId', params.academicYearId);
    if (params.academicTermId) query.set('academicTermId', params.academicTermId);

    const res = await apiFetch<{ success: boolean; data: ComprehensiveReportCardData[] }>(
      `${API_URL}/api/gradebook/report-cards/batch-comprehensive?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  // Mark Submission & Approval APIs
  async getSubmissionDashboard(filters?: {
    academicYearId?: string;
    academicTermId?: string;
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    teacherId?: string;
  }): Promise<SubmissionDashboardMetrics> {
    const query = new URLSearchParams();
    if (filters?.academicYearId) query.set('academicYearId', filters.academicYearId);
    if (filters?.academicTermId) query.set('academicTermId', filters.academicTermId);
    if (filters?.gradeId) query.set('gradeId', filters.gradeId);
    if (filters?.sectionId) query.set('sectionId', filters.sectionId);
    if (filters?.subjectId) query.set('subjectId', filters.subjectId);
    if (filters?.teacherId) query.set('teacherId', filters.teacherId);

    const res = await apiFetch<{ success: boolean; data: SubmissionDashboardMetrics }>(
      `${API_URL}/api/gradebook/submissions/dashboard?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data || { total: 0, submitted: 0, pendingApproval: 0, requiringAttention: 0, approved: 0, published: 0 };
  },

  async getSubmissions(params?: {
    academicYearId?: string;
    academicTermId?: string;
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ submissions: AssessmentSubmissionItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params?.academicYearId) query.set('academicYearId', params.academicYearId);
    if (params?.academicTermId) query.set('academicTermId', params.academicTermId);
    if (params?.gradeId) query.set('gradeId', params.gradeId);
    if (params?.sectionId) query.set('sectionId', params.sectionId);
    if (params?.subjectId) query.set('subjectId', params.subjectId);
    if (params?.teacherId) query.set('teacherId', params.teacherId);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await apiFetch<{
      success: boolean;
      data: AssessmentSubmissionItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>(
      `${API_URL}/api/gradebook/submissions?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return {
      submissions: res.data || [],
      pagination: res.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
    };
  },

  async getSubmissionDetails(id: string): Promise<SubmissionDetailsResponse> {
    const res = await apiFetch<{ success: boolean; data: SubmissionDetailsResponse }>(
      `${API_URL}/api/gradebook/submissions/${id}/details`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async approveSubmission(id: string): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/gradebook/submissions/${id}/approve`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },

  async returnSubmission(id: string, reason: string): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/gradebook/submissions/${id}/return`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  async reopenSubmission(id: string, reason: string): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/gradebook/submissions/${id}/reopen`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  },

  async publishSubmission(id: string): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/gradebook/submissions/${id}/publish`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );
    return res.data;
  },

  async bulkApproveSubmissions(ids: string[]): Promise<{
    successful: string[];
    failed: Array<{ id: string; reason: string }>;
    totalApproved: number;
    totalFailed: number;
  }> {
    const res = await apiFetch<{
      success: boolean;
      data: {
        successful: string[];
        failed: Array<{ id: string; reason: string }>;
        totalApproved: number;
        totalFailed: number;
      };
    }>(
      `${API_URL}/api/gradebook/submissions/bulk-approve`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
      }
    );
    return res.data;
  },

  async teacherSubmitMarks(data: {
    academicYearId: string;
    academicTermId: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    teacherId?: string;
    notes?: string;
  }): Promise<any> {
    const res = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/gradebook/submissions/submit`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async getClassGradebook(params: {
    academicYearId: string;
    academicTermId?: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
  }): Promise<ClassGradebookData> {
    const query = new URLSearchParams({
      academicYearId: params.academicYearId,
      gradeId: params.gradeId,
      sectionId: params.sectionId,
      subjectId: params.subjectId,
    });
    if (params.academicTermId) {
      query.append('academicTermId', params.academicTermId);
    }
    const res = await apiFetch<{ success: boolean; data: ClassGradebookData }>(
      `${API_URL}/api/gradebook/class-matrix?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async saveClassMarks(data: {
    academicYearId: string;
    academicTermId?: string;
    gradeId: string;
    sectionId: string;
    subjectId: string;
    marks: Array<{
      assessmentId: string;
      studentId: string;
      score: number | null;
      isAbsent?: boolean;
      status?: string;
      remarks?: string;
    }>;
  }): Promise<{ updatedCount: number; count: number; provisionalCalculationSummary?: any }> {
    const res = await apiFetch<{ success: boolean; data: any; message?: string }>(
      `${API_URL}/api/gradebook/class-matrix/save`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    const count = res.data?.updatedCount ?? res.data?.count ?? 0;
    return {
      updatedCount: count,
      count,
      provisionalCalculationSummary: res.data?.provisionalCalculationSummary || null,
    };
  },

  async getAssessmentReportsAnalytics(filters: {
    academicYearId?: string;
    academicTermId?: string;
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    streamId?: string;
    reportType?: string;
  } = {}): Promise<AssessmentReportsAnalyticsData> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') query.set(k, v);
    });
    const res = await apiFetch<{ success: boolean; data: AssessmentReportsAnalyticsData }>(
      `${API_URL}/api/gradebook/reports/analytics?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async getDetailedAssessmentReport(reportId: string, filters: Record<string, string> = {}): Promise<any> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') query.set(k, v);
    });
    const res = await apiFetch<{ success: boolean; data: any }>(
      `${API_URL}/api/gradebook/reports/${reportId}/detail?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
};

export interface AssessmentReportsAnalyticsData {
  summary: {
    totalSubjects: number;
    averageSubjectScore: number;
    highestSubject: { name: string; score: number; gradeName?: string } | null;
    lowestSubject: { name: string; score: number; gradeName?: string } | null;
    totalStudentsAssessed: number;
    completeAndPublishedResults: number;
  };
  subjectPerformance: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    averageScore: number;
    studentCount: number;
    highestScore: number;
    lowestScore: number;
    gradeName?: string;
  }>;
  distribution: {
    totalResults: number;
    bands: Array<{
      name: string;
      rangeLabel: string;
      minScore: number;
      maxScore: number;
      color: string;
      count: number;
      percentage: number;
    }>;
  };
  availableReports: Array<{
    id: string;
    reportName: string;
    type: string;
    typeKey: string;
    academicYear: string;
    term: string;
    grade: string;
    subjectOrStream: string;
    generatedOn: string;
    averageScore?: number;
    studentCount: number;
  }>;
}

export interface SubmissionDashboardMetrics {
  total: number;
  submitted: number;
  pendingApproval: number;
  requiringAttention: number;
  approved: number;
  published: number;
}

export interface AssessmentSubmissionItem {
  id: string;
  academicYearId: string;
  academicTermId: string;
  gradeId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  notes: string | null;
  subject: {
    id: string;
    name: string;
    code: string;
    color: string;
  };
  grade: {
    id: string;
    name: string;
  };
  section: {
    id: string;
    name: string;
  };
  teacher: {
    id: string;
    name: string;
    email?: string | null;
    profile_photo?: string | null;
  };
  academicYear: {
    id: string;
    name: string;
  };
  academicTerm: {
    id: string;
    name: string;
  };
  metrics: {
    totalStudents: number;
    validMarksCount: number;
    missingMarksCount: number;
    absentCount: number;
    completionPercentage: number;
    assessmentsCount: number;
    hasInvalidMark: boolean;
  };
}

export interface SubmissionDetailsResponse {
  submission: AssessmentSubmissionItem;
  assessments: Array<{
    id: string;
    title: string;
    type: string;
    maxScore: number;
    weightage: number;
    categoryName?: string;
  }>;
  students: Array<{
    studentId: string;
    studentNumber: string;
    fullName: string;
    gender?: string | null;
    marks: Array<{
      assessmentId: string;
      assessmentTitle: string;
      maxScore: number;
      weightage: number;
      score: number | null;
      status: string;
      isAbsent: boolean;
      excuseReason?: string | null;
      remarks?: string | null;
    }>;
    finalScore: number;
    finalPercentage: number | null;
    status: string;
    issues: string[];
  }>;
  stats: {
    totalStudents: number;
    completedStudents: number;
    missingStudents: number;
    absentStudents: number;
    completionPercentage: number;
    hasValidationErrors: boolean;
  };
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    author: string;
    timestamp: string;
  }>;
}

