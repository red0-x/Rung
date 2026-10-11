import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import { TRUST_LABEL, clock, usd } from '../format';
import type { QueueItemView, TranscriptResponse } from '../types';
import { Digits } from './Digits';
import { ScoreBar } from './ScoreBar';

export interface RowFlag {
  kind: 'new' | 'up';
  from?: number;
  until: number;
}

const SPEAKER: Record<string, string> = { agent: 'Voice agent', user: 'Caller', caller: 'Caller', transfer_target: 'Specialist' };

export function Transcript({ id }: { id: string }) {
  const [t, setT] = useState<TranscriptResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .transcript(id)
      .then((r) => alive && setT(r))
      .catch((e) => alive && setFailed(errorText(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  if (failed) return <p className="transcript">The transcript could not be loaded. {failed}</p>;
  if (!t) return <p className="transcript muted">Loading transcript…</p>;
  if (t.turns?.length) {
    return (
      <div className="transcript">
        {t.turns.map((turn, i) => (
          <p key={i}>
            <b>{SPEAKER[turn.speaker] ?? turn.speaker}</b> {turn.text}
          </p>
        ))}
      </div>
    );
  }
  return <p className="transcript">{t.transcript ?? 'No transcript yet.'}</p>;
}

interface Props {
  item: QueueItemView;
  nowEst: number;
  agingPerMin: number;
  agingCap: number;
  scaleMax: number;
  /** Minutes until a rep is likely free for this caller. */
  etaMin: number;
  flag?: RowFlag;
  busy: boolean;
  onClaim: (id: string) => void;
}

export function QueueRow({ item, nowEst, agingPerMin, agingCap, scaleMax, etaMin, flag, busy, onClaim }: Props) {
  const [showTranscript, setShowTranscript] = useState(false);
  const waitedMs = Math.max(0, nowEst - item.createdAt);
  // Aging creeps between polls; never show less than the server already counted.
  const agingExact = Math.max(item.score.aging, Math.min(agingCap, (waitedMs / 60_000) * agingPerMin));
  const aging = Math.floor(agingExact);
  const { urgency, value } = item.score;
  const total = urgency + value + aging;
  const isNext = item.rank === 1;

  return (
    <li className={`row tier-${item.tier}${isNext ? ' next' : ''}`} data-id={item.id}>
      <div className="rank tnum" aria-label={`Rank ${item.rank ?? ''}`}>
        {item.rank}
      </div>

      <div className="body">
        <div className="who">
          <h3 className="name">{item.name ?? 'Unknown caller'}</h3>
          <span className="phone tnum">{item.phoneMasked}</span>
          <span className={`trust trust-${item.trust}`}>{TRUST_LABEL[item.trust]}</span>
          {item.returning && <span className="trust trust-returning">Returning</span>}
          {flag && flag.until > Date.now() && (
            <span className="flag">{flag.kind === 'new' ? 'Just in' : `Up from #${flag.from}`}</span>
          )}
        </div>

        <p className="issue">
          <span className="tier-word">{item.tierLabel}</span>
          <span className="intent">{item.intentLabel}</span>
          {item.amountUsd != null && <span className="amount tnum">{usd(item.amountUsd)}</span>}
        </p>

        <ScoreBar urgency={urgency} value={value} aging={agingExact} scaleMax={scaleMax} />
        <p className="parts tnum">
          <span>
            <i className="sw sw-urgency" />
            Urgency {urgency}
          </span>
          <span>
            <i className="sw sw-value" />
            Value {value}
          </span>
          <span>
            <i className="sw sw-aging" />
            Waiting {aging}
          </span>
        </p>

        <p className="brief">{item.summary}</p>
        <p className="reason tnum">{item.reason}</p>

        {item.hasTranscript && (
          <button type="button" className="link-btn" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
        )}
        {showTranscript && <Transcript id={item.id} />}
      </div>

      <div className="side">
        <div className="metric">
          <span className="metric-n">
            <Digits text={clock(waitedMs)} />
          </span>
          <span className="metric-l">waiting</span>
        </div>
        <div className="metric">
          <span className="metric-n tnum">{total}</span>
          <span className="metric-l">points</span>
        </div>
        <p className="eta tnum">Callback in ~{etaMin} min</p>
        <button type="button" className={`btn${isNext ? ' btn-primary' : ''}`} disabled={busy} onClick={() => onClaim(item.id)}>
          {busy ? 'Opening…' : 'Call back'}
        </button>
      </div>
    </li>
  );
}
