import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../context/AuthContext';
import type { UserProfile } from '../types';

// ─── Mock Supabase (vi.hoisted ensures vars exist before vi.mock factory runs) ──

const {
  mockGetSession,
  mockSignInWithPassword,
  mockSignOut,
  mockSignInWithOAuth,
  mockOnAuthStateChange,
  mockFrom,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signInWithOAuth: mockSignInWithOAuth,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: mockFrom,
  },
}));

const mockUserProfile: UserProfile = {
  id: 'u1',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'employee',
  created_at: '2024-01-01T00:00:00Z',
};

function setupMocks({
  session = null as null | { user: { id: string } },
  profile = mockUserProfile as UserProfile | null,
  signInError = null as Error | null,
  oauthError = null as Error | null,
} = {}) {
  mockGetSession.mockResolvedValue({ data: { session } });
  mockOnAuthStateChange.mockImplementation((_cb: unknown) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));

  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });

  mockSignInWithPassword.mockResolvedValue({ error: signInError });
  mockSignOut.mockResolvedValue({});
  mockSignInWithOAuth.mockResolvedValue({ error: oauthError });
}

// ─── Consumer ────────────────────────────────────────────────────────────────

function Consumer() {
  const { session, user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="session">{session ? 'has-session' : 'no-session'}</span>
      <span data-testid="user">{user?.full_name ?? 'null'}</span>
      <span data-testid="role">{user?.role ?? 'null'}</span>
      <button onClick={() => signIn('test@example.com', 'pass')}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}

describe('AuthContext — no session', () => {
  beforeEach(() => {
    setupMocks({ session: null });
  });

  it('sets loading to false after init with no session', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('user is null when no session', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });

  it('session indicator is "no-session"', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('session').textContent).toBe('no-session');
    });
  });
});

describe('AuthContext — with session', () => {
  beforeEach(() => {
    setupMocks({ session: { user: { id: 'u1' } }, profile: mockUserProfile });
  });

  it('loads user profile from supabase after session is found', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User');
    });
  });

  it('sets loading to false after profile loaded', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('exposes the correct role', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('employee');
    });
  });
});

describe('AuthContext — signIn', () => {
  it('calls supabase.auth.signInWithPassword with correct credentials', async () => {
    setupMocks({ session: null });
    const user = userEvent.setup();
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByText('Sign In'));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'pass',
    });
  });

  it('returns { error: null } on successful sign-in', async () => {
    setupMocks({ session: null, signInError: null });
    let result: { error: Error | null } | undefined;
    function CaptureSignIn() {
      const { signIn } = useAuth();
      return (
        <button onClick={async () => { result = await signIn('e@e.com', 'p'); }}>
          Sign In
        </button>
      );
    }
    const user = userEvent.setup();
    render(<AuthProvider><CaptureSignIn /></AuthProvider>);
    await waitFor(() => {});
    await user.click(screen.getByText('Sign In'));
    expect(result?.error).toBeNull();
  });

  it('returns { error } on failed sign-in', async () => {
    const err = new Error('Invalid credentials');
    setupMocks({ session: null, signInError: err });
    let result: { error: Error | null } | undefined;
    function CaptureSignIn() {
      const { signIn } = useAuth();
      return (
        <button onClick={async () => { result = await signIn('bad@e.com', 'wrong'); }}>
          Sign In
        </button>
      );
    }
    const user = userEvent.setup();
    render(<AuthProvider><CaptureSignIn /></AuthProvider>);
    await waitFor(() => {});
    await user.click(screen.getByText('Sign In'));
    expect(result?.error).toBe(err);
  });
});

describe('AuthContext — signOut', () => {
  it('calls supabase.auth.signOut when signOut() is called', async () => {
    setupMocks({ session: { user: { id: 'u1' } } });
    const user = userEvent.setup();
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await user.click(screen.getByText('Sign Out'));
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('AuthContext — signInWithGoogle', () => {
  it('calls supabase.auth.signInWithOAuth with provider "google"', async () => {
    setupMocks({ session: null });
    let result: { error: Error | null } | undefined;
    function CaptureGoogle() {
      const { signInWithGoogle } = useAuth();
      return (
        <button onClick={async () => { result = await signInWithGoogle(); }}>
          Google
        </button>
      );
    }
    const user = userEvent.setup();
    render(<AuthProvider><CaptureGoogle /></AuthProvider>);
    await waitFor(() => {});
    await user.click(screen.getByText('Google'));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  it('returns { error: null } when signInWithOAuth resolves without error', async () => {
    setupMocks({ session: null, oauthError: null });
    let result: { error: Error | null } | undefined;
    function CaptureGoogle() {
      const { signInWithGoogle } = useAuth();
      return (
        <button onClick={async () => { result = await signInWithGoogle(); }}>
          Google
        </button>
      );
    }
    const user = userEvent.setup();
    render(<AuthProvider><CaptureGoogle /></AuthProvider>);
    await waitFor(() => {});
    await user.click(screen.getByText('Google'));
    expect(result?.error).toBeNull();
  });

  it('returns { error } when signInWithOAuth returns an error', async () => {
    const oauthErr = new Error('OAuth failed');
    setupMocks({ session: null, oauthError: oauthErr });
    let result: { error: Error | null } | undefined;
    function CaptureGoogle() {
      const { signInWithGoogle } = useAuth();
      return (
        <button onClick={async () => { result = await signInWithGoogle(); }}>
          Google
        </button>
      );
    }
    const user = userEvent.setup();
    render(<AuthProvider><CaptureGoogle /></AuthProvider>);
    await waitFor(() => {});
    await user.click(screen.getByText('Google'));
    expect(result?.error).toBe(oauthErr);
  });
});

describe('AuthContext — error guard', () => {
  it('throws when useAuth is used outside AuthProvider', () => {
    function Bad() {
      useAuth();
      return null;
    }
    const consoleError = console.error;
    console.error = () => {};
    expect(() => render(<Bad />)).toThrow('useAuth must be used within AuthProvider');
    console.error = consoleError;
  });
});
