import { getApiUrl } from './api-config';

const API_URL = getApiUrl();

export interface StudentDiscipline {
  id: string;
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
  witnesses?: string[] | null;
  evidence?: { url: string; name: string; type: string; size?: number }[] | null;
  immediateAction?: string | null;
  parentNotified: boolean;
  parentNotifiedAt?: string | null;
  parentAcknowledged: boolean;
  parentAcknowledgedAt?: string | null;
  parentAcknowledgementNotes?: string | null;
  followUpDate?: string | null;
  resolutionNotes?: string | null;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';
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

export interface DisciplineAnalytics {
  total: number;
  open: number;
  openCases: number;
  resolvedCases: number;
  criticalCases: number;
  thisMonth: number;
  byCategory: { name: string; value: number }[];
  bySeverity: { name: string; value: number }[];
  byGrade: { name: string; value: number }[];
  repeatOffenders: { student: { id: string; fullName: string; student_id: string }; count: number }[];
  topReporters: { name: string; count: number }[];
  monthlyMap: Record<string, number>;
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('attendance_token') : null;
  const schoolId = typeof window !== 'undefined' ? localStorage.getItem('x-school-id') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (schoolId) headers['x-school-id'] = schoolId;
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

import { queryCache } from './utils/query-cache';

function notifyDisciplineDataChanged() {
  queryCache.invalidate(/^discipline_/);
  queryCache.invalidate('discipline_');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('disciplineDataChanged'));
  }
}

export const DisciplineApi = {
  async getCategories(): Promise<DisciplineCategory[]> {
    const res = await fetch(`${API_URL}/api/discipline/categories`, { headers: getAuthHeaders() });
    const data = await handleResponse(res, 'Failed to fetch categories');
    return data.data || [];
  },

  async createCategory(name: string, description?: string): Promise<DisciplineCategory> {
    const res = await fetch(`${API_URL}/api/discipline/categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, description })
    });
    const data = await handleResponse(res, 'Failed to create category');
    notifyDisciplineDataChanged();
    return data.data;
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/discipline/categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    await handleResponse(res, 'Failed to delete category');
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
    const res = await fetch(`${API_URL}/api/discipline?${query.toString()}`, { headers: getAuthHeaders() });
    const data = await handleResponse(res, 'Failed to fetch incidents');
    return data;
  },

  async getIncidentById(id: string): Promise<StudentDiscipline> {
    const res = await fetch(`${API_URL}/api/discipline/${id}`, { headers: getAuthHeaders() });
    const data = await handleResponse(res, 'Failed to fetch incident detail');
    return data.data;
  },

  async createIncident(payload: any): Promise<StudentDiscipline> {
    const res = await fetch(`${API_URL}/api/discipline`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await handleResponse(res, 'Failed to create incident');
    notifyDisciplineDataChanged();
    return data.data;
  },

  async updateIncident(id: string, payload: any): Promise<StudentDiscipline> {
    const res = await fetch(`${API_URL}/api/discipline/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await handleResponse(res, 'Failed to update incident');
    notifyDisciplineDataChanged();
    return data.data;
  },

  async deleteIncident(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/discipline/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    await handleResponse(res, 'Failed to delete incident');
    notifyDisciplineDataChanged();
  },

  async acknowledgeIncident(id: string, notes?: string): Promise<StudentDiscipline> {
    const res = await fetch(`${API_URL}/api/discipline/${id}/acknowledge`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes })
    });
    const data = await handleResponse(res, 'Failed to acknowledge incident');
    notifyDisciplineDataChanged();
    return data.data;
  },

  async addFollowUp(id: string, payload: { note: string; actionTaken?: string; status?: string }): Promise<DisciplineFollowUp> {
    const res = await fetch(`${API_URL}/api/discipline/${id}/follow-up`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await handleResponse(res, 'Failed to add follow-up');
    notifyDisciplineDataChanged();
    return data.data;
  },

  async getAnalytics(): Promise<DisciplineAnalytics> {
    const res = await fetch(`${API_URL}/api/discipline/analytics`, { headers: getAuthHeaders() });
    const data = await handleResponse(res, 'Failed to fetch analytics');
    return data.data;
  }
};
