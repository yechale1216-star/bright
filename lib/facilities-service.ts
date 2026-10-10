import { apiFetch } from '@/lib/utils/fetch-with-timeout';
import { getApiUrl } from './api-config';

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

// ─── Library Types ──────────────────────────────────────────────────────────

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  category: string;
  publisher?: string;
  publicationYear?: number;
  totalCopies: number;
  availableCopies: number;
  shelfLocation?: string;
  description?: string;
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    borrowRecords: number;
  };
}

export interface BookBorrowRecord {
  id: string;
  bookId: string;
  studentId?: string;
  userId?: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'BORROWED' | 'RETURNED' | 'OVERDUE' | 'LOST';
  notes?: string;
  isOverdue?: boolean;
  book?: Book;
  student?: {
    id: string;
    fullName: string;
    student_id: string;
    grade?: { name: string };
    section?: { name: string };
  };
  user?: {
    id: string;
    full_name: string;
    role: string;
  };
}

export interface LibraryStats {
  totalCopies: number;
  uniqueTitles: number;
  activeBorrows: number;
  overdueBorrows: number;
}

// ─── Transport Types ────────────────────────────────────────────────────────

export interface TransportVehicle {
  id: string;
  plateNumber: string;
  model: string;
  capacity: number;
  driverName: string;
  driverPhone: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | string;
  createdAt: string;
  updatedAt: string;
  routes?: { id: string; name: string; startPoint: string; endPoint: string }[];
}

export interface RouteStop {
  name: string;
  time?: string;
  order: number;
}

export interface TransportRoute {
  id: string;
  name: string;
  startPoint: string;
  endPoint: string;
  stops?: RouteStop[];
  vehicleId?: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: string;
  updatedAt: string;
  vehicle?: TransportVehicle;
  assignments?: StudentTransportAssignment[];
  _count?: {
    assignments: number;
  };
}

export interface StudentTransportAssignment {
  id: string;
  studentId: string;
  routeId: string;
  pickupStop?: string;
  dropoffStop?: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: string;
  student?: {
    id: string;
    fullName: string;
    student_id: string;
    parent_phone?: string;
    parent_name?: string;
    grade?: { name: string };
    section?: { name: string };
  };
  route?: TransportRoute;
}

export interface TransportStats {
  totalVehicles: number;
  totalRoutes: number;
  assignedStudents: number;
}

// ─── Facilities Client Service ──────────────────────────────────────────────

export const libraryClientService = {
  async getBooks(params?: { category?: string; search?: string; page?: number; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    const res = await apiFetch<{ success: boolean; books: Book[]; total: number }>(
      `${API_URL}/api/library/books${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.books || [];
  },

  async getBookById(id: string) {
    const res = await apiFetch<{ success: boolean; data: Book }>(
      `${API_URL}/api/library/books/${id}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async createBook(data: Partial<Book>) {
    const res = await apiFetch<{ success: boolean; data: Book }>(
      `${API_URL}/api/library/books`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateBook(id: string, data: Partial<Book>) {
    const res = await apiFetch<{ success: boolean; data: Book }>(
      `${API_URL}/api/library/books/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async deleteBook(id: string) {
    return apiFetch<{ success: boolean }>(
      `${API_URL}/api/library/books/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
  },

  async borrowBook(data: { bookId: string; studentId?: string; userId?: string; dueDate: string; notes?: string }) {
    const res = await apiFetch<{ success: boolean; data: BookBorrowRecord }>(
      `${API_URL}/api/library/borrow`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async returnBook(borrowId: string, notes?: string) {
    const res = await apiFetch<{ success: boolean; data: BookBorrowRecord }>(
      `${API_URL}/api/library/return/${borrowId}`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes }),
      }
    );
    return res.data;
  },

  async getBorrowRecords(params?: { status?: string; studentId?: string; userId?: string; bookId?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.studentId) q.set('studentId', params.studentId);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.bookId) q.set('bookId', params.bookId);
    const qs = q.toString();
    const res = await apiFetch<{ success: boolean; data: BookBorrowRecord[] }>(
      `${API_URL}/api/library/borrows${qs ? `?${qs}` : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async getStats() {
    const res = await apiFetch<{ success: boolean; data: LibraryStats }>(
      `${API_URL}/api/library/stats`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
};

export const transportClientService = {
  async getVehicles() {
    const res = await apiFetch<{ success: boolean; data: TransportVehicle[] }>(
      `${API_URL}/api/transport/vehicles`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async createVehicle(data: Partial<TransportVehicle>) {
    const res = await apiFetch<{ success: boolean; data: TransportVehicle }>(
      `${API_URL}/api/transport/vehicles`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateVehicle(id: string, data: Partial<TransportVehicle>) {
    const res = await apiFetch<{ success: boolean; data: TransportVehicle }>(
      `${API_URL}/api/transport/vehicles/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async deleteVehicle(id: string) {
    return apiFetch<{ success: boolean }>(
      `${API_URL}/api/transport/vehicles/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
  },

  async getRoutes() {
    const res = await apiFetch<{ success: boolean; data: TransportRoute[] }>(
      `${API_URL}/api/transport/routes`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async getRouteById(id: string) {
    const res = await apiFetch<{ success: boolean; data: TransportRoute }>(
      `${API_URL}/api/transport/routes/${id}`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  async createRoute(data: Partial<TransportRoute>) {
    const res = await apiFetch<{ success: boolean; data: TransportRoute }>(
      `${API_URL}/api/transport/routes`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async updateRoute(id: string, data: Partial<TransportRoute>) {
    const res = await apiFetch<{ success: boolean; data: TransportRoute }>(
      `${API_URL}/api/transport/routes/${id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async deleteRoute(id: string) {
    return apiFetch<{ success: boolean }>(
      `${API_URL}/api/transport/routes/${id}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
  },

  async assignStudent(data: { studentId: string; routeId: string; pickupStop?: string; dropoffStop?: string }) {
    const res = await apiFetch<{ success: boolean; data: StudentTransportAssignment }>(
      `${API_URL}/api/transport/assign`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },

  async removeStudent(assignmentId: string) {
    return apiFetch<{ success: boolean }>(
      `${API_URL}/api/transport/assignments/${assignmentId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
  },

  async getStudentTransport(studentId: string) {
    const res = await apiFetch<{ success: boolean; data: StudentTransportAssignment[] }>(
      `${API_URL}/api/transport/students/${studentId}`,
      { headers: getAuthHeaders() }
    );
    return res.data || [];
  },

  async getStats() {
    const res = await apiFetch<{ success: boolean; data: TransportStats }>(
      `${API_URL}/api/transport/stats`,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
};
