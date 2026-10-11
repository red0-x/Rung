import { useState } from 'react';
import { api, errorText } from '../api';
import { IconRefresh } from '../components/Icons';
import { PageHeader } from '../components/Shell';
import { TIERS, TIER_LABEL } from '../format';
import { usePoll } from '../hooks';
import type { InsightsResponse } from '../types';

type Item = InsightsResponse['items'][number];
type Row = { key: string; label: string; cls: string };

/** "normal 2 · critical 1" -> { normal: 2, critical: 1 }. Anything else ("No calls yet") -> {}. */
function counts(answer: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (answer ?? '').split(' · ')) {
    const m = part.trim().match(/^(.+) (\d+)$/);
    if (m) out[m[1]!] = Number(m[2]);
  }
  return out;
}

const TIER_ROWS: Row[] = TIERS.map((t) => ({ key: t, label: TIER_LABEL[t], cls: `tier-${t}` }));

/** Display per insight id. Unknown ids still render with the server's title. */
const META: Record<string, { title: string; rows?: Row[]; caption: (c: Record<string, number>, total: number) => string; hero?: boolean }> = {
  queued_by_urgency: {
    title: 'Calls queued',
    rows: TIER_ROWS,
    caption: (c, t) => (t ? `${c.critical ?? 0} urgent went straight to the top` : 'No calls queued yet'),
    hero: true,
  },
  callers: {
    title: 'Returning callers',
    rows: [
      { key: 'known', label: 'Returning', cls: 'tier-normal' },
      { key: 'new', label: 'New', cls: 'tier-low' },
    ],
    caption: (c, t) => (t ? `${Math.round(((c.known ?? 0) / t) * 100)}% didn't have to explain again` : 'No calls yet'),
  },
  callbacks_made: {
    title: 'Callbacks made',
    rows: TIER_ROWS,
    caption: (c, t) => (t ? `${c.critical ?? 0} of them urgent` : 'No callbacks yet'),
  },
  context_saved: {
    title: 'Details remembered',
    caption: (_c, t) => (t ? `callers known on their next call` : 'No details saved yet'),
  },
  eta_text: {
    title: 'Callback-time texts',
    rows: [
      { key: 'sent', label: 'Sent', cls: 'tier-normal' },
      { key: 'failed', label: 'Failed', cls: 'tier-critical' },
      { key: 'skipped', label: 'Skipped', cls: 'tier-low' },
    ],
    caption: (c, t) => (t ? `${c.sent ?? 0} callers told when to expect us` : 'No texts yet'),
  },
};

function Tile({ item }: { item: Item }) {
  const meta = META[item.id];
  const rows = meta?.rows;
  const c = counts(item.answer);
  // Answers without a breakdown ("4 callers had details saved…") carry their total up front.
  const total = rows ? Object.values(c).reduce((a, b) => a + b, 0) : Number(item.answer?.match(/^\d+/)?.[0] ?? 0);
  const failed = !!item.error && !item.answer;
  return (
    <section className={`tile ins-tile${meta?.hero ? ' tile-tint' : ''}`} aria-label={meta?.title ?? item.title}>
      <p className="tile-label">{meta?.title ?? item.title}</p>
      <p className="tile-num tnum">{failed ? '–' : total}</p>
      <p className="tile-cap">{failed ? item.error : meta ? meta.caption(c, total) : item.answer}</p>
      {rows && !failed && (
        <>
          <div className="seg-bar" aria-hidden="true">
            {rows.map((r) => (c[r.key] ? <i key={r.key} className={r.cls} style={{ width: `${(c[r.key]! / Math.max(1, total)) * 100}%` }} /> : null))}
          </div>
          <dl className="tier-stats">
            {rows.map((r) => (
              <div key={r.key} className={`${r.cls}${c[r.key] ? '' : ' is-zero'}`}>
                <dt>
                  <i className="tier-dot" aria-hidden="true" />
                  {r.label}
                </dt>
                <dd className="tnum">{c[r.key] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function InsightsPage() {
  const poll = usePoll(() => api.insights(), 60_000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const data = poll.data;

  const refresh = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.insights(true);
      poll.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const status = err ?? data?.note ?? (data?.asOf ? `Updated ${hhmm(data.asOf)}${data.stale ? ' · out of date' : ''}` : null);

  return (
    <div className="page-pad ins-page">
      <PageHeader
        title="Insights"
        sentence="How the last 24 hours went, beyond the live queue."
        right={
          <div className="ins-tools">
            <span className="ins-powered">
              Powered by <b>Keewano</b>
            </span>
            {data?.enabled && (
              <button type="button" className={`round-btn ins-refresh${busy ? ' is-busy' : ''}`} onClick={refresh} disabled={busy} aria-label="Ask Keewano again" data-tip="Ask Keewano again">
                <IconRefresh width={18} height={18} />
              </button>
            )}
          </div>
        }
      />

      {poll.error && !data ? (
        <p className="banner" role="alert">
          {errorText(poll.error)}
        </p>
      ) : !data ? (
        <div className="ins-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="tile sk-tile ins-tile" />
          ))}
        </div>
      ) : !data.enabled ? (
        <section className="card ins-off">
          <h2 className="card-title">Keewano isn't connected</h2>
          <p className="muted">Set KEEWANO_SDK_KEY and KEEWANO_ACCESS_TOKEN on the server to turn on Insights.</p>
        </section>
      ) : (
        <div className="ins-grid">
          {data.items.map((i) => (
            <Tile key={i.id} item={i} />
          ))}
        </div>
      )}

      {status && <p className="muted small ins-status">{status}</p>}

      <p className="muted small">
        Counted by Keewano from anonymous call events (no phone numbers or names), a few minutes behind live. For right now, use the Queue.
      </p>
    </div>
  );
}
