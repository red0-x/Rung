import { api } from '../api';
import { ago } from '../format';
import { useNow, usePoll } from '../hooks';
import { PageHeader, initials } from '../components/Shell';

export default function CallersPage() {
  const profiles = usePoll(api.profiles, 8000);
  const now = useNow(30_000);
  const list = profiles.data?.profiles ?? [];
  const verified = list.filter((p) => p.verified).length;
  return (
    <div className="page-pad">
      <PageHeader
        title="Callers"
        sentence={profiles.data ? `${list.length} remembered · ${verified} verified by text code` : ' '}
      />
      {!profiles.data ? (
        <div className="callers-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card sk-card-sm" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No one saved yet.</p>
          <p className="muted">Callers who agree to be remembered appear here.</p>
        </div>
      ) : (
        <ul className="callers-grid">
          {list.map((p, i) => (
            <li key={p.phoneMasked + p.name} className="card caller-card" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <span className="avatar avatar-lg tier-normal" aria-hidden="true">
                {initials(p.name)}
              </span>
              <span className="caller-main">
                <b>{p.name}</b>
                <span className="muted tnum">{p.phoneMasked}</span>
              </span>
              <span className="caller-meta">
                <span className={`chip${p.verified ? ' trust-verified' : ''}`}>{p.verified ? 'Verified' : 'Unverified'}</span>
                <span className="muted small">since {ago(now - p.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
