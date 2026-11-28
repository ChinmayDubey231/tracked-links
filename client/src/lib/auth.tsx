import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, MeResponse, PublicUser } from '@tracked-links/shared';
import { api, getToken, onUnauthorized, setToken } from './api';
import { LoadingState } from '../components/States';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  /** Starts a demo sandbox: a copy of the sample account, deleted after 24 hours. */
  startDemo: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anonymous'));

  // Restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) return;
    const controller = new AbortController();
    api<MeResponse>('/auth/me', { signal: controller.signal })
      .then(({ user: me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        // A network failure keeps the token so a reload can retry; a 401 already cleared it.
        setStatus(getToken() ? 'authenticated' : 'anonymous');
      });
    return () => controller.abort();
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null);
        setStatus('anonymous');
        queryClient.clear();
      }),
    [queryClient],
  );

  const finish = useCallback((response: AuthResponse) => {
    setToken(response.token);
    setUser(response.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      finish(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }));
    },
    [finish],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      finish(await api<AuthResponse>('/auth/signup', { method: 'POST', body: { name, email, password }, auth: false }));
    },
    [finish],
  );

  const startDemo = useCallback(async () => {
    finish(await api<AuthResponse>('/auth/demo', { method: 'POST', auth: false }));
  }, [finish]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, login, signup, startDemo, logout }),
    [status, user, login, signup, startDemo, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** Sends signed-out visitors to /login, then back here after they log in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState label="Checking your session…" fullPage />;
  if (status === 'anonymous') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

/** Keeps signed-in users away from the log-in and sign-up forms. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState label="Checking your session…" fullPage />;
  if (status === 'authenticated') return <Navigate to={safeNext(location.search)} replace />;
  return <>{children}</>;
}

/** The ?next= target, limited to paths on this site so it can't redirect elsewhere. */
export function safeNext(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/documents';
}
