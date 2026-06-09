import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/db';
import type { DbSession } from '../lib/db';
import type { UserProfile } from '../types';

interface AuthContextType {
  session: DbSession | null;
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<DbSession | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setUser(data ?? null);
  }

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = db.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session?.user) {
          (async () => {
            await fetchProfile(session.user.id);
          })();
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) await fetchProfile(currentSession.user.id);
  }

  async function signIn(email: string, password: string) {
    const { error } = await db.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }

  async function signInWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  }

  async function signOut() {
    await db.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
