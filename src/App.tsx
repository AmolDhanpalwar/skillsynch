import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import PrivateRoute from './components/auth/PrivateRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import TmgDashboardPage from './pages/TmgDashboardPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import SkillFormPage from './pages/SkillFormPage';
import ManagerReviewPage from './pages/ManagerReviewPage';
import StatusPage from './pages/StatusPage';
import PowerBiHelpPage from './pages/PowerBiHelpPage';
import { seedUsersIfEmpty } from './lib/seedUsers';

function RoleRoot() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const map: Record<string, string> = {
    employee: '/dashboard',
    manager: '/inbox',
    tmg: '/tmg-dashboard',
    management: '/reports',
    admin: '/admin',
  };
  return <Navigate to={map[user.role] ?? '/dashboard'} replace />;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 200ms ease, transform 200ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
}

function AppRoutes() {
  useEffect(() => {
    seedUsersIfEmpty();
  }, []);

  return (
    <PageTransition>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RoleRoot />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute allowedRoles={['employee', 'manager', 'tmg', 'management', 'admin']}>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/inbox"
          element={
            <PrivateRoute allowedRoles={['manager', 'tmg', 'admin']}>
              <InboxPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/inbox/review/:formId"
          element={
            <PrivateRoute allowedRoles={['manager', 'tmg', 'admin']}>
              <ManagerReviewPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/tmg-dashboard"
          element={
            <PrivateRoute allowedRoles={['manager', 'tmg', 'admin']}>
              <TmgDashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <PrivateRoute allowedRoles={['management', 'admin']}>
              <ReportsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/status"
          element={
            <PrivateRoute allowedRoles={['tmg', 'admin']}>
              <StatusPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/help/powerbi"
          element={
            <PrivateRoute allowedRoles={['tmg', 'management', 'admin']}>
              <PowerBiHelpPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <AdminPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/form"
          element={
            <PrivateRoute allowedRoles={['employee']}>
              <SkillFormPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<RoleRoot />} />
      </Routes>
    </PageTransition>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
