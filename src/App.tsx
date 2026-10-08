import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';

import LandingPage from './pages/LandingPage.js';
import LoginPage from './pages/LoginPage.js';
import RegisterPage from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { ApplicationsPage } from './pages/ApplicationsPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { RecruitmentDetailPage } from './pages/RecruitmentDetailPage.js';
import { GovernmentLinksPage } from './pages/GovernmentLinksPage.js';

import type { ToastMessage } from './components/common/Toast.js';

// Route guard for protected pages — redirects unauthenticated users to /login
function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Route guard for public auth pages — redirects already logged-in users to /dashboard
function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRoutes() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 5);
    const newToast: ToastMessage = { id, type, text };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Auth Pages (redirect to /dashboard if logged in) */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* Protected SaaS Application Pages */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <DashboardPage onShowToast={showToast} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <NotificationsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/government-links"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <GovernmentLinksPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Redirect old /eligibility route to /profile */}
      <Route
        path="/eligibility"
        element={<Navigate to="/profile" replace />}
      />

      <Route
        path="/applications"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <ApplicationsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <ProfilePage onShowToast={showToast} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <SettingsPage onShowToast={showToast} />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Recruitment Detail */}
      <Route
        path="/recruitments/:recruitmentId"
        element={
          <ProtectedRoute>
            <AppLayout toasts={toasts} onDismissToast={dismissToast}>
              <RecruitmentDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
