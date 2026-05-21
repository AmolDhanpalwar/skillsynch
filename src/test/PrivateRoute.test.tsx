import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from '../components/auth/PrivateRoute';
import type { UserProfile } from '../types';

// ─── Mock AuthContext ─────────────────────────────────────────────────────────

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../context/AuthContext';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function makeUser(role: UserProfile['role']): UserProfile {
  return {
    id: 'u1',
    email: 'test@example.com',
    full_name: 'Test User',
    role,
    created_at: '2024-01-01T00:00:00Z',
  };
}

function renderWithRouter(
  ui: React.ReactNode,
  { initialPath = '/' } = {}
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/admin" element={<div>Admin Page</div>} />
        <Route path="/inbox" element={<div>Inbox Page</div>} />
        <Route path="/tmg-dashboard" element={<div>TMG Dashboard</div>} />
        <Route path="/reports" element={<div>Reports Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PrivateRoute — loading state', () => {
  it('renders loading spinner when loading is true', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, loading: true });
    renderWithRouter(
      <PrivateRoute><div>Protected Content</div></PrivateRoute>
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders loading spinner when session exists but user profile is not yet loaded', () => {
    mockUseAuth.mockReturnValue({ session: { user: { id: 'u1' } }, user: null, loading: false });
    renderWithRouter(
      <PrivateRoute><div>Protected Content</div></PrivateRoute>
    );
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('does not render protected content while loading', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, loading: true });
    renderWithRouter(
      <PrivateRoute><div>Protected Content</div></PrivateRoute>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

describe('PrivateRoute — unauthenticated', () => {
  it('redirects to /login when no session', () => {
    mockUseAuth.mockReturnValue({ session: null, user: null, loading: false });
    renderWithRouter(
      <PrivateRoute><div>Protected Content</div></PrivateRoute>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

describe('PrivateRoute — authenticated with matching role', () => {
  it('renders children when no allowedRoles restriction', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('employee'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute><div>Protected Content</div></PrivateRoute>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user role is in allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('admin'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute allowedRoles={['admin', 'tmg']}><div>Admin Content</div></PrivateRoute>
    );
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});

describe('PrivateRoute — authenticated with wrong role', () => {
  it('redirects employee to /dashboard when employee tries to access admin-only route', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('employee'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute allowedRoles={['admin']}><div>Admin Only</div></PrivateRoute>
    );
    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('redirects manager to /inbox when manager tries to access tmg-only route', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('manager'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute allowedRoles={['tmg', 'admin']}><div>TMG Only</div></PrivateRoute>
    );
    expect(screen.queryByText('TMG Only')).not.toBeInTheDocument();
    expect(screen.getByText('Inbox Page')).toBeInTheDocument();
  });

  it('redirects tmg to /tmg-dashboard when tmg tries employee-only route', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('tmg'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute allowedRoles={['employee']}><div>Employee Only</div></PrivateRoute>
    );
    expect(screen.queryByText('Employee Only')).not.toBeInTheDocument();
    expect(screen.getByText('TMG Dashboard')).toBeInTheDocument();
  });
});

describe('PrivateRoute — multi-role scenarios', () => {
  it('allows tmg when allowedRoles includes both tmg and admin', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('tmg'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute allowedRoles={['tmg', 'admin']}><div>Privileged Content</div></PrivateRoute>
    );
    expect(screen.getByText('Privileged Content')).toBeInTheDocument();
  });

  it('allows admin when allowedRoles includes multiple roles', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      user: makeUser('admin'),
      loading: false,
    });
    renderWithRouter(
      <PrivateRoute allowedRoles={['tmg', 'management', 'admin']}><div>Multi Role</div></PrivateRoute>
    );
    expect(screen.getByText('Multi Role')).toBeInTheDocument();
  });
});
