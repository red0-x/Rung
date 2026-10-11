import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../api';
import { capitalize, clock, usd } from '../format';
import { useCountUp } from '../hooks';
import type { QueueItemView, TranscriptResponse } from '../types';
import { useCollapseOut } from '../useFlip';
import { Digits } from './Digits';
import { ScoreBar } from './ScoreBar';
import { initials } from './Shell';

export interface RowFlag {
  kind: 'new' | 'up';
  from?: number;
  until: number;
}

const SPEAKER: Record<string, string> = { agent: 'Agent', user: 'Caller', caller: 'Caller', transfer_target: 'Specialist' };

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

  if (failed) return <p className="transcript">Couldn't load the transcript. {failed}</p>;
  if (!t) return <p className="transcript muted">Loading…</p>;
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

export function Avatar({ item, size = 'md' }: { item: QueueItemView; size?: 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar-${size} tier-${item.tier}`} aria-hidden="true">
      {item.name ? initials(item.name) : '?'}
    </span>
  );
}

/** Small glyph per tier so urgency reads before the words do. */
export function TierIcon({ tier }: { tier: QueueItemView['tier'] }) {
  const d =
    tier === 'critical'
      ? 'M8 2.5 14 13H2z M8 6.5v3 M8 11.3v.01'
      : tier === 'high'
        ? 'M8 13V3.5 M4 7.5l4-4 4 4'
        : tier === 'normal'
          ? 'M4.5 8h7'
          : 'M8 3v9.5 M4 8.5l4 4 4-4';
  return (
    <svg className="tier-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function TierPill({ item }: { item: QueueItemView }) {
  return (
    <span className={`tier-pill tier-${item.tier}`} title={item.tierLabel}>
      <TierIcon tier={item.tier} />
      <span className="tier-pill-text">{item.tierLabel}</span>
    </span>
  );
}

/** Wait pill warms with time: amber past 5 min, red past 15. */
export function waitHeat(ms: number): string {
  return ms >= 15 * 60_000 ? ' is-hot' : ms >= 5 * 60_000 ? ' is-warm' : '';
}

export function liveAging(item: QueueItemView, nowEst: number, perMin: number, cap: number): number {
  const waited = Math.max(0, nowEst - item.createdAt);
  return Math.max(item.score.aging, Math.min(cap, (waited / 60_000) * perMin));
}

interface RowProps {
  item: QueueItemView;
  nowEst: number;
  agingPerMin: number;
  agingCap: number;
  flag?: RowFlag;
  selected: boolean;
  leaving: boolean;
  onSelect: (id: string) => void;
}

/** One ranked caller in the master list. The whole row is the selection button. */
export function ListRow({ item, nowEst, agingPerMin, agingCap, flag, selected, leaving, onSelect }: RowProps) {
  const ref = useRef<HTMLLIElement>(null);
  useCollapseOut(ref, leaving, 280);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const inCall = item.status === 'in_progress';
  const sinceMs = Math.max(0, nowEst - (inCall ? (item.claimedAt ?? item.createdAt) : item.createdAt));
  const aging = Math.floor(liveAging(item, nowEst, agingPerMin, agingCap));
  const total = useCountUp(item.score.urgency + item.score.value + aging, 500);
  const fresh = flag && flag.until > Date.now() ? flag : undefined;

  return (
    <li
      ref={ref}
      data-id={item.id}
      data-leaving={leaving || undefined}
      className={`lrow-wrap tier-${item.tier}${selected ? ' is-selected' : ''}${fresh?.kind === 'new' ? ' is-new' : ''}${inCall ? ' is-call' : ''}`}
    >
      <button
        type="button"
        className="lrow"
        aria-pressed={selected}
        aria-label={`${inCall ? 'On a call' : `Rank ${item.rank}`}: ${item.name ?? 'Unknown caller'}, ${item.intentLabel}`}
        onClick={() => onSelect(item.id)}
        disabled={leaving}
      >
        <span className="lrow-rank tnum" aria-hidden="true">
          {inCall ? (
            <i className="call-dot" />
          ) : (
            <span key={item.rank ?? 0} className={mounted.current ? 'rank-n roll' : 'rank-n'}>
              {item.rank}
            </span>
          )}
        </span>
        <Avatar item={item} />
        <span className="lrow-main">
          <span className="lrow-name">
            <span className={`lrow-nm${item.name ? '' : ' unknown-name'}`}>{item.name ?? 'Unknown caller'}</span>
            <TierPill item={item} />
            {fresh && <span className="flag">{fresh.kind === 'new' ? 'New' : `Up from #${fresh.from}`}</span>}
          </span>
          <span className="lrow-sub">
            <span className="lrow-intent">{capitalize(item.intentLabel)}</span>
            {item.amountUsd != null && <b className="money tnum">{usd(item.amountUsd)}</b>}
          </span>
          {!item.name && <span className="unknown-hint tnum">{item.phoneMasked} · name not captured</span>}
        </span>
        <span className="lrow-meta">
          <span className={`wait-pill tnum${inCall ? ' is-call' : waitHeat(sinceMs)}`}>
            <Digits text={clock(sinceMs)} />
          </span>
          {!inCall && (
            <span className="lrow-score tnum">
              <ScoreBar urgency={item.score.urgency} value={item.score.value} aging={aging} scaleMax={Math.max(160, total)} />
              {total}
            </span>
          )}
          {inCall && <span className="lrow-score">on call</span>}
        </span>
      </button>
    </li>
  );
}
