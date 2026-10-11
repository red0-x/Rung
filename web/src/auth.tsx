import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api, setTokenGetter } from './api';
import type { MeResponse } from './types';

// Supabase is used for Auth only. The browser never queries tables; every API
// call goes to our server with the user's access token.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const DEV_KEY = 'rung.devToken';
export const DEV_AUTH_AVAILABLE = import.meta.env.DEV;

function readDevToken(): string | null {
  if (!DEV_AUTH_AVAILABLE) return null;
  try {
    return window.localStorage.getItem(DEV_KEY);
  } catch {
    return null;
  }
}

type Session = { token: string; email: string; kind: 'supabase' | 'dev' } | null;

interface AuthState {
  /** False until the stored session has been read. */
  ready: boolean;
  session: Session;
  me: MeResponse | null;
  meError: string | null;
  meLoading: boolean;
  refreshMe: () => Promise<MeResponse | null>;
  signInDev: (email: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [supa, setSupa] = useState<Session>(null);
  const [devToken, setDevToken] = useState<string | null>(readDevToken);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [meLoading, setMeLoading] = useState(false);

  // A real Supabase session wins over a dev token.
  const session: Session = supa ?? (devToken ? { token: devToken, email: devToken.slice(4), kind: 'dev' } : null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = session?.token ?? null;
  // Requests read the ref, so they always carry the current token.
  setTokenGetter(() => tokenRef.current);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const s = data.session;
      setSupa(s ? { token: s.access_token, email: s.user.email ?? '', kind: 'supabase' } : null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSupa(s ? { token: s.access_token, email: s.user.email ?? '', kind: 'supabase' } : null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      window.localStorage.removeItem(DEV_KEY);
    } catch {
      /* ignore */
    }
    setDevToken(null);
    setMe(null);
    setMeError(null);
    if (supabase) await supabase.auth.signOut();
    setSupa(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!tokenRef.current) {
      setMe(null);
      return null;
    }
    setMeLoading(true);
    try {
      const res = await api.me();
      setMe(res);
      setMeError(null);
      return res;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        setMeError('Your session expired. Sign in again.');
      } else {
        setMeError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      setMeLoading(false);
    }
  }, [signOut]);

  // Load /api/me whenever the signed-in identity changes (not on every token refresh).
  const identity = session ? `${session.kind}:${session.email}` : '';
  useEffect(() => {
    if (!ready) return;
    if (!identity) {
      setMe(null);
      return;
    }
    void refreshMe();
  }, [identity, ready, refreshMe]);

  const signInDev = useCallback((email: string) => {
    const token = `dev:${email.trim()}`;
    try {
      window.localStorage.setItem(DEV_KEY, token);
    } catch {
      /* ignore */
    }
    setMeError(null);
    setDevToken(token);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, session, me, meError, meLoading, refreshMe, signInDev, signOut }),
    [ready, session?.token, session?.email, session?.kind, me, meError, meLoading, refreshMe, signInDev, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
