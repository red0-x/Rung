import { useEffect, useState, type FormEvent } from 'react';
import { DEV_AUTH_AVAILABLE, supabase, useAuth } from '../auth';
import { linkClick, navigate, useLocation } from '../router';
import { BrandLogo } from '../components/BrandLogo';

export default function LoginPage() {
  const { search } = useLocation();
  const { ready, session, me, meError, meLoading } = useAuth();
  const signup = search.has('signup');
  const [email, setEmail] = useState(search.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Signed in and /api/me answered: no org yet → setup, else → the board.
  useEffect(() => {
    if (ready && session && me) navigate(me.org ? '/queue' : '/setup', { replace: true });
  }, [ready, session, me]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const switchHref = `/login${signup ? '' : '?signup'}${email ? `${signup ? '?' : '&'}email=${encodeURIComponent(email)}` : ''}`;
  const working = busy || (!!session && meLoading);

  return (
    <div className="login">
      <svg className="login-pills" viewBox="0 0 600 900" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        {/* The brand's supporting pattern: rounded cobalt bars, some joined by a diagonal. */}
        <g className="drift d1">
          <path d="M330 110 H640" />
          <path d="M150 250 H300 L380 360 H640" />
        </g>
        <g className="drift d2">
          <path d="M260 520 H420" />
          <path d="M500 520 H640" />
        </g>
        <g className="drift d3">
          <path d="M120 690 H250 L330 790 H520" />
          <path d="M440 650 H640" />
        </g>
      </svg>

      <div className="login-col">
        <a href="/" onClick={linkClick} className="login-logo" aria-label="Rung home">
          <BrandLogo size={56} />
        </a>
        <h1 className="login-title">{signup ? 'Set up your Rung.' : 'Welcome back.'}</h1>
        <p className="login-sub">
          {signup ? 'Remembered callers. Callbacks instead of hold music.' : 'Sign in to work your callback queue.'}
        </p>

        {supabase ? (
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>Work email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-ink btn-block" disabled={working}>
              {working ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
            </button>
          </form>
        ) : (
          <p className="notice">Supabase isn't configured for this build. {DEV_AUTH_AVAILABLE ? 'Use dev sign-in below.' : ''}</p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {meError && !error && (
          <p className="form-error" role="alert">
            {meError}
          </p>
        )}
        {notice && <p className="notice">{notice}</p>}

        {supabase && (
          <p className="login-switch">
            {signup ? 'Already have an account? ' : 'New to Rung? '}
            <a href={switchHref} onClick={linkClick}>
              {signup ? 'Sign in' : 'Create an account'}
            </a>
          </p>
        )}

        {DEV_AUTH_AVAILABLE && <DevSignIn initial={email} />}
      </div>
    </div>
  );
}

function DevSignIn({ initial }: { initial: string }) {
  const { signInDev } = useAuth();
  const [email, setEmail] = useState(initial);
  return (
    <form
      className="dev-signin"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) signInDev(email);
      }}
    >
      <p className="eyebrow">Dev sign-in</p>
      
      <div className="inline">
        <input type="email" required placeholder="demo user email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Dev email" />
        <button type="submit" className="btn">
          Dev sign-in
        </button>
      </div>
    </form>
  );
}
