import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth';
import { linkClick, navigate } from '../router';
import { BrandLogo } from './BrandLogo';
import { IconCallers, IconCollapse, IconInsights, IconLogout, IconPeople, IconQueue, IconSetup } from './Icons';

const NAV = [
  { href: '/queue', label: 'Queue', Icon: IconQueue },
  { href: '/callers', label: 'Callers', Icon: IconCallers },
  { href: '/insights', label: 'Insights', Icon: IconInsights },
  { href: '/setup', label: 'Setup', Icon: IconSetup },
];

const COLLAPSE_KEY = 'rung.sidebar';

// Profile pictures for the demo orgs, keyed by slug (files in web/public/orgs/).
const ORG_AVATARS: Record<string, string> = {
  'demo-bank': '/orgs/demo-bank.png',
  'northside-clinic': '/orgs/northside-clinic.png',
};

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { me, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const org = me?.org;

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Rung">
        <div className="sb-top">
          <a href="/queue" onClick={linkClick} className="sb-logo" aria-label="Rung, go to queue">
            <BrandLogo collapsed={collapsed} size={collapsed ? 30 : 32} />
          </a>
          <button
            type="button"
            className="sb-collapse"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((c) => !c)}
          >
            <IconCollapse />
          </button>
        </div>
        <nav className="sb-nav" aria-label="Dashboard">
          {NAV.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              onClick={linkClick}
              className="sb-link"
              aria-current={path === href ? 'page' : undefined}
              data-tip={collapsed ? label : undefined}
            >
              <Icon />
              <span className="sb-label">{label}</span>
            </a>
          ))}
        </nav>
        <div className="sb-foot">
          {org && (
            <p className="sb-org">
              <span className={`sb-avatar${ORG_AVATARS[org.slug] ? ' has-img' : ''}`} aria-hidden="true">
                {ORG_AVATARS[org.slug] ? <img src={ORG_AVATARS[org.slug]} alt="" /> : initials(org.name)}
              </span>
              <span className="sb-label">{org.name}</span>
            </p>
          )}
          <button
            type="button"
            className="sb-link sb-logout"
            aria-label="Log out"
            onClick={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
            data-tip={collapsed ? 'Log out' : undefined}
          >
            <IconLogout />
            <span className="sb-label">Log out</span>
          </button>
        </div>
      </aside>
      <main className="shell-main">{children}</main>
    </div>
  );
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '?';
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function PageHeader({ title, sentence, right }: { title: ReactNode; sentence?: ReactNode; right?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sentence && <p className="page-sentence">{sentence}</p>}
      </div>
      {right && <div className="page-head-right">{right}</div>}
    </header>
  );
}

/** With a team online, shows who's here and how many are free; a solo rep sees the original pill. */
export function ReadyPill({ offline, reps }: { offline?: boolean; reps?: { online: number; available: number } }) {
  const team = reps && reps.online > 1;
  return (
    <span className={`ready-pill${offline ? ' is-down' : ''}${team && reps.available === 0 ? ' is-full' : ''}`} role="status">
      <span className="rp-seg rp-queue">
        <IconPeople width={16} height={16} />
        {team ? `${reps.online} reps online` : 'Priority queue'}
      </span>
      <span className="rp-seg">
        <i className="dot" aria-hidden="true" />
        {offline ? 'Reconnecting' : !team ? 'Ready for callback' : reps.available ? `${reps.available} free for callback` : 'Everyone is on a call'}
      </span>
    </span>
  );
}
