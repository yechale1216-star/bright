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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (schoolId) headers['x-school-id'] = schoolId;
  if (userRole) headers['x-requested-role'] = userRole;
  return headers;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Homework {
  id: string;
  title: string;
  description?: string | null;
  subjectId: string;
  teacherId?: string | null;
  gradeId: string;
  sectionId?: string | null;
  dueDate: string;
  maxScore: number;
  attachments?: any;
  status: string;
  createdAt: string;
  updatedAt: string;
  subject?: { id: string; name: string; code: string; color: string };
  teacher?: { id: string; name: string; profile_photo?: string | null } | null;
  grade?: { id: string; name: string };
  section?: { id: string; name: string } | null;
  _count?: { submissions: number };
  // Student-specific fields
  submission?: HomeworkSubmission | null;
  isSubmitted?: boolean;
  isOverdue?: boolean;
}

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submissionText?: string | null;
  attachments?: any;
  submittedAt: string;
  status: string;
  score?: number | null;
  feedback?: string | null;
  gradedById?: string | null;
  gradedAt?: string | null;
  student?: { id: string; fullName: string; student_id: string };
}

export interface LearningMaterial {
  id: string;
  title: string;
  description?: string | null;
  subjectId: string;
  gradeId: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  uploadedById?: string | null;
  createdAt: string;
  updatedAt: string;
  subject?: { id: string; name: string; code: string; color: string };
  grade?: { id: string; name: string };
}

// ─── Homework Service ─────────────────────────────────────────────────────────

export const homeworkClientService = {
  // Teacher/Admin
  getAll: async (filters?: {
    gradeId?: string;
    sectionId?: string;
    subjectId?: string;
    teacherId?: string;
    status?: string;
  }): Promise<Homework[]> => {
    const params = new URLSearchParams();
    if (filters?.gradeId) params.set('gradeId', filters.gradeId);
    if (filters?.sectionId) params.set('sectionId', filters.sectionId);
    if (filters?.subjectId) params.set('subjectId', filters.subjectId);
    if (filters?.teacherId) params.set('teacherId', filters.teacherId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    const res = await apiFetch<{ success: boolean; data: Homework[] }>(
      `${API_URL}/api/homework${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.data ?? [];
  },

  getById: async (id: string): Promise<Homework | null> => {
    const res = await apiFetch<{ success: boolean; data: Homework }>(
      `${API_URL}/api/homework/${id}`,
      { headers: getAuthHeaders() }
    );
    return res.data ?? null;
  },

  create: async (data: {
    title: string;
    description?: string;
    subjectId: string;
    gradeId: string;
    sectionId?: string;
    dueDate: string;
    maxScore?: number;
    status?: string;
    attachments?: any;
  }): Promise<Homework> => {
    const res = await apiFetch<{ success: boolean; data: Homework }>(
      `${API_URL}/api/homework`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  update: async (id: string, data: Partial<Homework>): Promise<Homework> => {
    const res = await apiFetch<{ success: boolean; data: Homework }>(
      `${API_URL}/api/homework/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiFetch(`${API_URL}/api/homework/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  getSubmissions: async (assignmentId: string): Promise<HomeworkSubmission[]> => {
    const res = await apiFetch<{ success: boolean; data: HomeworkSubmission[] }>(
      `${API_URL}/api/homework/${assignmentId}/submissions`,
      { headers: getAuthHeaders() }
    );
    return res.data ?? [];
  },

  gradeSubmission: async (
    submissionId: string,
    data: { score: number; feedback?: string }
  ): Promise<HomeworkSubmission> => {
    const res = await apiFetch<{ success: boolean; data: HomeworkSubmission }>(
      `${API_URL}/api/homework/submissions/${submissionId}/grade`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  // Student portal
  getStudentHomework: async (
    studentId: string,
    filters?: { subjectId?: string }
  ): Promise<Homework[]> => {
    const params = new URLSearchParams();
    if (filters?.subjectId) params.set('subjectId', filters.subjectId);
    const qs = params.toString();
    const res = await apiFetch<{ success: boolean; data: Homework[] }>(
      `${API_URL}/api/homework/student/${studentId}${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.data ?? [];
  },

  submitHomework: async (
    assignmentId: string,
    studentId: string,
    data: { submissionText?: string; attachments?: any }
  ): Promise<HomeworkSubmission> => {
    const res = await apiFetch<{ success: boolean; data: HomeworkSubmission }>(
      `${API_URL}/api/homework/${assignmentId}/submit`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ studentId, ...data }),
      }
    );
    return res.data;
  },
};

// ─── Learning Materials Service ───────────────────────────────────────────────

export const learningMaterialClientService = {
  getAll: async (filters?: { gradeId?: string; subjectId?: string }): Promise<LearningMaterial[]> => {
    const params = new URLSearchParams();
    if (filters?.gradeId) params.set('gradeId', filters.gradeId);
    if (filters?.subjectId) params.set('subjectId', filters.subjectId);
    const qs = params.toString();
    const res = await apiFetch<{ success: boolean; data: LearningMaterial[] }>(
      `${API_URL}/api/learning-materials${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.data ?? [];
  },

  create: async (data: {
    title: string;
    description?: string;
    subjectId: string;
    gradeId: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
  }): Promise<LearningMaterial> => {
    const res = await apiFetch<{ success: boolean; data: LearningMaterial }>(
      `${API_URL}/api/learning-materials`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  update: async (id: string, data: Partial<LearningMaterial>): Promise<LearningMaterial> => {
    const res = await apiFetch<{ success: boolean; data: LearningMaterial }>(
      `${API_URL}/api/learning-materials/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiFetch(`${API_URL}/api/learning-materials/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  getStudentMaterials: async (
    studentId: string,
    filters?: { subjectId?: string }
  ): Promise<LearningMaterial[]> => {
    const params = new URLSearchParams();
    if (filters?.subjectId) params.set('subjectId', filters.subjectId);
    const qs = params.toString();
    const res = await apiFetch<{ success: boolean; data: LearningMaterial[] }>(
      `${API_URL}/api/learning-materials/student/${studentId}${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.data ?? [];
  },
};
