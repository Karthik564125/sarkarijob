import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL as string;

if (!BASE_URL) {
  console.error('VITE_API_URL is not set. Check your .env file.');
}

// Axios instance — base URL comes from env, never hardcoded
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sarkarijob_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — clear token and redirect to /login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sarkarijob_token');
      localStorage.removeItem('sarkarijob_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth endpoints ---
export const authApi = {
  register: (data: {
    fullName: string;
    username: string;
    email: string;
    phone?: string;
    password: string;
  }) => apiClient.post('/auth/register', data),

  login: (data: { usernameOrEmail: string; password: string }) =>
    apiClient.post('/auth/login', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/auth/change-password', data),
};

// --- Profile endpoints ---
export const profileApi = {
  get: () => apiClient.get('/profile'),

  updatePersonal: (data: {
    full_name?: string;
    date_of_birth?: string;
    gender?: string;
    state_of_domicile?: string;
    reservation_category?: string;
  }) => apiClient.put('/profile', data),

  updateAccount: (data: { email?: string; phone?: string }) =>
    apiClient.put('/profile/account', data),

  updateEducation10th: (data: {
    school_name?: string;
    board?: string;
    passing_year?: number;
    percentage?: string;
  }) => apiClient.put('/profile/education/10th', data),

  updateEducation12th: (data: {
    school_college_name?: string;
    board?: string;
    stream?: string;
    passing_year?: number;
    percentage?: string;
  }) => apiClient.put('/profile/education/12th', data),

  updateEducationGraduation: (data: {
    degree?: string;
    branch?: string;
    university?: string;
    passing_year?: number;
    percentage_or_cgpa?: string;
  }) => apiClient.put('/profile/education/graduation', data),
};

// --- Recruitment endpoints (Phase 7) ---
export const recruitmentApi = {
  // Dashboard summary counters for authenticated user
  getDashboardSummary: () => apiClient.get('/recruitments/dashboard-summary'),

  // Currently open recruitments — the exact list behind the "Open Now" dashboard counter
  getOpen: () => apiClient.get('/recruitments/open'),

  // Paginated list of user-relevant recruitments (eligible + verify by default)
  getRelevant: (params?: {
    status?: 'eligible' | 'verify' | 'not_eligible' | 'all';
    organization?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get('/recruitments/relevant', { params }),

  // Full matches list with optional filters
  getMatches: (params?: {
    status?: string;
    organization?: string;
    includeClosed?: boolean;
  }) => apiClient.get('/recruitments/matches', { params }),

  // Recent recruitment events for the user's matched jobs
  getMyEvents: (params?: { page?: number; limit?: number; organization?: string }) =>
    apiClient.get('/recruitments/my-events', { params }),

  // User-specific manual application decisions
  getApplications: () => apiClient.get('/recruitments/applications'),
  setApplicationStatus: (recruitmentId: string, application_status: 'applied' | 'not_applied') =>
    apiClient.post(`/recruitments/${recruitmentId}/application`, { application_status }),

  // Detail page: recruitment info + user match + timeline
  getDetail: (recruitmentId: string) =>
    apiClient.get(`/recruitments/${recruitmentId}`),

  // Manual trigger for end-to-end recruitment monitoring
  checkNow: () => apiClient.post('/recruitments/check-now'),
};
