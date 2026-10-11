import { useState } from 'react';
import { api, errorText } from '../api';
import { TIERS, TIER_LABEL } from '../format';
import { usePoll } from '../hooks';
import type { InsightsResponse } from '../types';
import { IconRefresh } from './Icons';

type Item = InsightsResponse['items'][number];

/** "normal 2 · critical 1" -> { normal: 2, critical: 1 }. Anything else ("No calls yet") -> {}. */
function counts(answer: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of (answer ?? '').split(' · ')) {
    const m = part.trim().match(/^(.+) (\d+)$/);
    if (m) out[m[1]!] = Number(m[2]);
  }
  return out;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const ROWS: Record<string, Array<{ key: string; label: string; cls: string }>> = {
  queued_by_urgency: TIERS.map((t) => ({ key: t, label: TIER_LABEL[t], cls: `tier-${t}` })),
  callbacks_made: TIERS.map((t) => ({ key: t, label: TIER_LABEL[t], cls: `tier-${t}` })),
  callers: [
    { key: 'known', label: 'Returning', cls: 'tier-normal' },
    { key: 'new', label: 'New', cls: 'tier-low' },
  ],
  eta_text: [
    { key: 'sent', label: 'Sent', cls: 'tier-normal' },
    { key: 'failed', label: 'Failed', cls: 'tier-critical' },
    { key: 'skipped', label: 'Skipped', cls: 'tier-low' },
  ],
};

const TITLE: Record<string, string> = {
  queued_by_urgency: 'Calls queued',
  callers: 'Callers',
  callbacks_made: 'Callbacks made',
  context_saved: 'Details remembered',
  eta_text: 'Callback-time texts',
};

function Stat({ item }: { item: Item }) {
  const rows = ROWS[item.id];
  const c = counts(item.answer);
  // Answers without a breakdown ("4 callers had details saved…") carry their total up front.
  const total = rows ? Object.values(c).reduce((a, b) => a + b, 0) : Number(item.answer?.match(/^\d+/)?.[0] ?? 0);
  return (
    <div className="ins-stat">
      <p className="ins-stat-head">
        <span>{TITLE[item.id] ?? item.title}</span>
        <b className="tnum">{item.error && !item.answer ? '–' : total}</b>
      </p>
      {item.error && !item.answer ? (
        <p className="muted small">{item.error}</p>
      ) : rows ? (
        <dl className="tier-stats ins-tiers">
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
      ) : null}
    </div>
  );
}

/** Keewano-counted call stats for the last 24 h. Hidden when Keewano isn't configured on the server. */
export function InsightsCard() {
  const poll = usePoll(() => api.insights(), 60_000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const data = poll.data;
  if (!data || !data.enabled) return null;

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

  return (
    <section className="card insights" aria-labelledby="ins-h">
      <div className="ins-head">
        <h2 id="ins-h" className="card-title">
          Last 24 h
        </h2>
        <span className="ins-badge" data-tip="Every call sends anonymous events to Keewano (no phone numbers or names). These counts come back from Keewano, a few minutes behind live calls.">
          Keewano
        </span>
        <button type="button" className={`icon-btn ins-refresh${busy ? ' is-busy' : ''}`} onClick={refresh} disabled={busy} aria-label="Ask Keewano again" data-tip="Ask Keewano again">
          <IconRefresh width={16} height={16} />
        </button>
      </div>
      <div className="ins-stats">
        {data.items.map((i) => (
          <Stat key={i.id} item={i} />
        ))}
      </div>
      <p className="muted small ins-foot">
        {err ?? data.note ?? (data.asOf ? `Counted by Keewano · ${hhmm(data.asOf)}${data.stale ? ' · out of date' : ''}` : 'Waiting for Keewano')}
      </p>
    </section>
  );
}
