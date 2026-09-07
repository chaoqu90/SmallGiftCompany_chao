/**
 * AuthContext — Supabase session state available to the entire React tree.
 *
 * On mount:
 *   1. Calls supabase.auth.getSession() to restore any persisted session.
 *   2. Subscribes to onAuthStateChange for real-time session updates
 *      (sign-in, sign-out, token refresh, OAuth callback).
 *   3. Unsubscribes on unmount to avoid memory leaks.
 *
 * Usage:
 *   const { session, user, loading } = useAuth();
 *
 * Requirements: R1 (AC1.3), R3 (AC3.2), R4 (AC4.2, AC4.3), R5 (AC5.1, AC5.5, AC5.6)
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  user:    User    | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user,    setUser]    = useState<User    | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore existing session (from localStorage) on first render.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2. Subscribe to future auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      },
    );

    // 3. Unsubscribe when the provider unmounts.
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
