import { getApiUrl } from './api-config';
import { queryCache } from './utils/query-cache';
import { apiFetch } from './utils/fetch-with-timeout';

const API_URL = getApiUrl();

export interface StudentDiscipline {
  id: string;
  caseNumber?: string | null;
  schoolId: string;
  studentId: string;
  gradeId: string;
  sectionId: string;
  streamId?: string | null;
  date: string;
  time?: string | null;
  categoryId?: string | null;
  categoryName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  location?: string | null;
  reportedById?: string | null;
  reportedByName?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  witnesses?: string[] | null;
  evidence?: { url: string; name: string; type: string; size?: number }[] | null;
  immediateAction?: string | null;
  investigationNotes?: string | null;
  findings?: string | null;
  meetingNotes?: string | null;
  confidentialNotes?: string | null;
  recommendedAction?: string | null;
  approvedAction?: string | null;
  actionDate?: string | null;
  responsibleStaffName?: string | null;
  actionStatus?: string | null;
  parentNotified: boolean;
  parentNotifiedAt?: string | null;
  parentAcknowledged: boolean;
  parentAcknowledgedAt?: string | null;
  parentAcknowledgementNotes?: string | null;
  followUpDate?: string | null;
  resolutionNotes?: string | null;
  status: 'OPEN' | 'UNDER_REVIEW' | 'INVESTIGATION' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;

  student?: {
    id: string;
    student_id: string;
    fullName: string;
    parent_email?: string;
    parent_phone?: string;
    parent_name?: string;
    grade?: { name: string };
    section?: { name: string };
    stream?: { name: string };
  };
  grade?: { id: string; name: string };
  section?: { id: string; name: string };
  stream?: { id: string; name: string } | null;
  reportedBy?: { id: string; full_name: string; email: string; role: string } | null;
  assignedTo?: { id: string; full_name: string; email: string; role?: string } | null;
  followUps?: DisciplineFollowUp[];
  auditLogs?: { id: string; action: string; user_id?: string; old_values?: any; new_values?: any; created_at: string }[];
}

export interface DisciplineFollowUp {
  id: string;
  disciplineId: string;
  authorId?: string | null;
  authorName?: string | null;
  note: string;
  actionTaken?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
  createdAt: string;
}

export interface DisciplineCategory {
  id: string;
  schoolId?: string | null;
  name: string;
  description?: string | null;
  isDefault: boolean;
}

export interface DisciplineActionConfig {
  id: string;
  schoolId?: string | null;
  name: string;
  description?: string | null;
  isDefault: boolean;
}

export interface StudentDisciplineProfile {
  student: {
    id: string;
    student_id: string;
    fullName: string;
    gender?: string | null;
    grade: string;
    section: string;
    stream?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
  };
  summaryStats: {
    title: string;
    totalCases: number;
    openCases: number;
    underReviewCases: number;
    resolvedCases: number;
    followUpsDue: number;
    severityBreakdown: {
      LOW: number;
      MEDIUM: number;
      HIGH: number;
      CRITICAL: number;
    };
  };
  history: StudentDiscipline[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DisciplineAnalytics {
  total: number;
  open: number;
  openCases: number;
  underReviewCases?: number;
  actionRequiredCases?: number;
  resolvedCases: number;
  criticalCases: number;
  thisMonth: number;
  byCategory: { name: string; value: number }[];
  bySeverity: { name: string; value: number }[];
  byGrade: { name: string; value: number }[];
  repeatOffenders: { student: { id: string; fullName: string; student_id: string; grade?: string; section?: string }; count: number }[];
  monthlyMap: Record<string, number>;
}

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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (schoolId) headers['x-school-id'] = schoolId;
  if (userRole) headers['x-requested-role'] = userRole;
  return headers;
}

async function handleResponse(res: Response, defaultErrorMsg: string) {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errorMsg = defaultErrorMsg;
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        errorMsg = data.message || data.error || defaultErrorMsg;
      } catch {
        // Ignore JSON parse error on non-ok response
      }
    }
    throw new Error(errorMsg);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }

  return await res.json();
}

function notifyDisciplineDataChanged() {
  queryCache.invalidate(/^discipline_/);
  queryCache.invalidate('discipline_');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('disciplineDataChanged'));
  }
}

export const DisciplineApi = {
  /**
   * Synchronously get cached incidents for instant (0ms) render.
   */
  getCachedIncidents(params: Record<string, any> = {}): {
    items: StudentDiscipline[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const cacheKey = `discipline_incidents_${query.toString() || 'default'}`;
    return queryCache.get<{
      items: StudentDiscipline[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);
  },
  async getCategories(): Promise<DisciplineCategory[]> {
    const data = await apiFetch<{ success: boolean; data?: DisciplineCategory[] }>(
      `${API_URL}/api/discipline/categories`,
      { headers: getAuthHeaders() }
    );
    return data.data || [];
  },

  async createCategory(name: string, description?: string): Promise<DisciplineCategory> {
    const data = await apiFetch<{ success: boolean; data: DisciplineCategory }>(
      `${API_URL}/api/discipline/categories`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description })
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async deleteCategory(id: string): Promise<void> {
    await apiFetch(
      `${API_URL}/api/discipline/categories/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders()
      }
    );
    notifyDisciplineDataChanged();
  },

  async getActionsConfig(): Promise<DisciplineActionConfig[]> {
    const data = await apiFetch<{ success: boolean; data?: DisciplineActionConfig[] }>(
      `${API_URL}/api/discipline/actions-config`,
      { headers: getAuthHeaders() }
    );
    return data.data || [];
  },

  async createActionConfig(name: string, description?: string): Promise<DisciplineActionConfig> {
    const data = await apiFetch<{ success: boolean; data: DisciplineActionConfig }>(
      `${API_URL}/api/discipline/actions-config`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description })
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async deleteActionConfig(id: string): Promise<void> {
    await apiFetch(
      `${API_URL}/api/discipline/actions-config/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders()
      }
    );
    notifyDisciplineDataChanged();
  },

  async getIncidents(params: Record<string, any> = {}): Promise<{
    items: StudentDiscipline[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const cacheKey = `discipline_incidents_${query.toString() || 'default'}`;
    return queryCache.fetch(
      cacheKey,
      async () => {
        return await apiFetch<{
          items: StudentDiscipline[];
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        }>(
          `${API_URL}/api/discipline?${query.toString()}`,
          { 
            headers: getAuthHeaders(),
            timeoutMs: 8000,
            retries: 1
          }
        );
      },
      { staleTime: 60_000, persist: true }
    );
  },

  async getIncidentById(id: string): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline/${id}`,
      { headers: getAuthHeaders() }
    );
    return data.data;
  },

  async getStudentProfile(studentId: string, params: Record<string, any> = {}): Promise<StudentDisciplineProfile> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const data = await apiFetch<{ success: boolean; data: StudentDisciplineProfile }>(
      `${API_URL}/api/discipline/student/${studentId}?${query.toString()}`,
      { headers: getAuthHeaders() }
    );
    return data.data;
  },

  async createIncident(payload: any): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
        timeoutMs: 0 // Do not limit submission time when files/videos are attached
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async updateIncident(id: string, payload: any): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
        timeoutMs: 0 // Do not limit submission time when files/videos are attached
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async assignOfficer(id: string, officerId: string, notes?: string): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline/${id}/assign`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ officerId, notes })
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async updateInvestigation(id: string, payload: {
    investigationNotes?: string;
    findings?: string;
    meetingNotes?: string;
    confidentialNotes?: string;
    status?: string;
  }): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline/${id}/investigation`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
        timeoutMs: 0
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async updateAction(id: string, payload: {
    recommendedAction?: string;
    approvedAction?: string;
    actionDate?: string;
    responsibleStaffName?: string;
    actionStatus?: string;
    status?: string;
    notes?: string;
  }): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline/${id}/action`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async deleteIncident(id: string): Promise<void> {
    await apiFetch(
      `${API_URL}/api/discipline/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders()
      }
    );
    notifyDisciplineDataChanged();
  },

  async acknowledgeIncident(id: string, notes?: string): Promise<StudentDiscipline> {
    const data = await apiFetch<{ success: boolean; data: StudentDiscipline }>(
      `${API_URL}/api/discipline/${id}/acknowledge`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes })
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async addFollowUp(id: string, payload: { note: string; actionTaken?: string; status?: string }): Promise<DisciplineFollowUp> {
    const data = await apiFetch<{ success: boolean; data: DisciplineFollowUp }>(
      `${API_URL}/api/discipline/${id}/follow-up`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      }
    );
    notifyDisciplineDataChanged();
    return data.data;
  },

  async getAnalytics(): Promise<DisciplineAnalytics> {
    const data = await apiFetch<{ success: boolean; data: DisciplineAnalytics }>(
      `${API_URL}/api/discipline/analytics`,
      { headers: getAuthHeaders() }
    );
    return data.data;
  }
};

export const disciplineService = DisciplineApi;
export type DisciplineIncident = StudentDiscipline;
export default DisciplineApi;

