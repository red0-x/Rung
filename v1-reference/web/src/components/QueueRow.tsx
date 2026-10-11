import { useEffect, useState } from 'react';
import { api } from '../api';
import { TRUST_LABEL, clock, issueSentence } from '../format';
import type { QueueItemView, TranscriptResponse } from '../types';
import { Digits } from './Digits';
import { ScoreBar } from './ScoreBar';

export interface RowFlag {
  kind: 'new' | 'up';
  from?: number;
  until: number;
}

interface Props {
  item: QueueItemView;
  nowEst: number;
  agingPerMin: number;
  agingCap: number;
  scaleMax: number;
  flag?: RowFlag;
  busy: boolean;
  onClaim: (id: string) => void;
}

const SPEAKER: Record<string, string> = { agent: 'Voice agent', user: 'Caller', transfer_target: 'Specialist' };

function Transcript({ id }: { id: string }) {
  const [t, setT] = useState<TranscriptResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api.transcript(id).then(setT).catch(() => setFailed(true));
  }, [id]);

  if (failed) return <p className="transcript">The transcript could not be loaded.</p>;
  if (!t) return <p className="transcript">Loading transcript…</p>;
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

export function QueueRow({ item, nowEst, agingPerMin, agingCap, scaleMax, flag, busy, onClaim }: Props) {
  const [showTranscript, setShowTranscript] = useState(false);
  const waitedMs = Math.max(0, nowEst - item.createdAt);
  const agingExact = Math.min(agingCap, (waitedMs / 60_000) * agingPerMin);
  const aging = Math.floor(agingExact);
  const { urgency, value } = item.score;
  const total = urgency + value + aging;
  const isNext = item.rank === 1;

  return (
    <li className={`row tier-${item.tier}${isNext ? ' next' : ''}`} data-id={item.id}>
      <div className="rank">
        <span className="sr">Number </span>
        {item.rank}
      </div>

      <div className="body">
        <div className="who">
          <h3 className="name">{item.name ?? 'Unknown caller'}</h3>
          <span className="phone">{item.phoneMasked}</span>
          <span className={`trust trust-${item.trust}`}>{TRUST_LABEL[item.trust]}</span>
          {flag && flag.until > nowEst && (
            <span className="flag">{flag.kind === 'new' ? 'Just in' : `Moved up from #${flag.from}`}</span>
          )}
        </div>

        <p className="issue">
          <span className="tier-word">{item.tierLabel}.</span> {issueSentence(item)}
        </p>

        <ScoreBar urgency={urgency} value={value} aging={agingExact} scaleMax={scaleMax} />
        <p className="parts">
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

        {item.hasTranscript && (
          <button type="button" className="link" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
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
          <span className="metric-n">{total}</span>
          <span className="metric-l">points</span>
        </div>
        <button
          type="button"
          className={`btn${isNext ? ' primary' : ''}`}
          disabled={busy}
          onClick={() => onClaim(item.id)}
        >
          Call back
        </button>
      </div>
    </li>
  );
}
