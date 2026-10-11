import { useAuth } from '../auth';
import { linkClick, navigate } from '../router';

export function Header({ path }: { path: string }) {
  const { me, session, signOut } = useAuth();
  const org = me?.org;
  const dial = me?.platform.dial;

  return (
    <header className="app-header">
      <div className="hdr-left">
        <a href={org ? '/queue' : '/'} onClick={linkClick} className="wordmark" aria-label="Rung home">
          Rung
        </a>
        <span className="hdr-div" aria-hidden="true" />
        <span className="hdr-item">Priority queue</span>
        <span className="hdr-div" aria-hidden="true" />
        <span className="hdr-item">
          <i className="dot dot-ready" aria-hidden="true" /> Ready for callback
        </span>
      </div>
      <div className="hdr-right">
        {org && <span className="hdr-org">{org.name}</span>}
        <nav className="hdr-nav" aria-label="Dashboard">
          <a href="/queue" onClick={linkClick} aria-current={path === '/queue' ? 'page' : undefined}>
            Queue
          </a>
          <a href="/setup" onClick={linkClick} aria-current={path === '/setup' ? 'page' : undefined}>
            Setup
          </a>
        </nav>
        {dial && (
          <span className={`badge badge-${dial}`} title={dial === 'mock' ? 'Dial calls are recorded, not sent' : 'Connected to Dial'}>
            Dial: {dial}
          </span>
        )}
        {session && (
          <button
            type="button"
            className="link-btn"
            title={session.email}
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
