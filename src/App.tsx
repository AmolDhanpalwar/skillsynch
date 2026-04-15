import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/auth/PrivateRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import TmgDashboardPage from './pages/TmgDashboardPage';
import ReportsPage from './pages/ReportsPage';
import AdminPage from './pages/AdminPage';
import SkillFormPage from './pages/SkillFormPage';
import ManagerReviewPage from './pages/ManagerReviewPage';
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

function AppRoutes() {
  useEffect(() => {
    seedUsersIfEmpty();
  }, []);

  return (
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
          <PrivateRoute allowedRoles={['tmg', 'admin']}>
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
