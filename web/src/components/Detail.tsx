import { useState } from 'react';
import { useAuth } from '../auth';
import { capitalize, clock, usd } from '../format';
import { useCountUp } from '../hooks';
import type { QueueItemView } from '../types';
import { Digits } from './Digits';
import { IconClose, IconPhone } from './Icons';
import { Transcript, liveAging } from './QueueRow';
import { ScoreBar } from './ScoreBar';

export type BusyKind = 'call' | 'done' | 'release';

interface Props {
  item: QueueItemView;
  nowEst: number;
  agingPerMin: number;
  agingCap: number;
  scaleMax: number;
  etaMin: number;
  phone?: { phone: string; tel: string };
  busy: BusyKind | null;
  onCallBack: (item: QueueItemView) => void;
  onDone: (item: QueueItemView) => void;
  onRelease: (item: QueueItemView) => void;
  onClose: () => void;
}

/** The selected caller's brief. Keyed by id so a selection change crossfades. */
export function Detail({ item, nowEst, agingPerMin, agingCap, scaleMax, etaMin, phone, busy, onCallBack, onDone, onRelease, onClose }: Props) {
  const [showTranscript, setShowTranscript] = useState(false);
  const requireVerification = useAuth().me?.platform.requireVerification ?? false;
  const inCall = item.status === 'in_progress';
  const aging = liveAging(item, nowEst, agingPerMin, agingCap);
  const { urgency, value } = item.score;
  const total = useCountUp(urgency + value + Math.floor(aging), 500);
  const trust = item.trust === 'new' ? 'New caller' : item.trust === 'verified' && requireVerification ? 'Verified' : 'Recognized';

  return (
    <div className={`detail-body tier-${item.tier}`}>
      <button type="button" className="icon-btn detail-close" aria-label="Close" onClick={onClose}>
        <IconClose />
      </button>
      <div className="detail-top">
        <div className="detail-who">
          <h3 className={`detail-name${item.name ? '' : ' unknown-name'}`}>{item.name ?? 'Unknown caller'}</h3>
          <p className="detail-phone tnum">
            {phone ? <span className="revealed">{phone.phone}</span> : item.phoneMasked}
            <span aria-hidden="true"> · </span>
            {trust}
          </p>
        </div>
        <span className="id-pill tnum">{inCall ? 'On a call' : `#${item.rank} · ${total} pts`}</span>
      </div>

      <div className="chips">
        <span className="chip">{capitalize(item.intentLabel)}</span>
        {item.amountUsd != null && <span className="chip tnum">{usd(item.amountUsd)}</span>}
        <span className="chip">{item.returning ? 'Returning' : 'First call'}</span>
      </div>

      <dl className="facts">
        <div>
          <dt>Issue</dt>
          <dd>{item.summary}</dd>
        </div>
        <div>
          <dt>{inCall ? 'On call' : 'Waiting'}</dt>
          <dd className="tnum">
            <Digits text={clock(nowEst - (inCall ? (item.claimedAt ?? nowEst) : item.createdAt))} />
            {!inCall && <span className="muted"> · callback in ~{etaMin} min</span>}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd className="fact-score">
            <ScoreBar urgency={urgency} value={value} aging={aging} scaleMax={scaleMax} label={item.reason} />
            <span className="tnum">{total}</span>
          </dd>
        </div>
        <div>
          <dt>Reason</dt>
          <dd className="muted">{item.reason}</dd>
        </div>
      </dl>

      {item.hasTranscript && (
        <div>
          <button type="button" className="link-btn" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
          {showTranscript && <Transcript id={item.id} />}
        </div>
      )}

      <div className="detail-actions">
        {inCall ? (
          <>
            {phone && (
              <a className="btn btn-primary btn-lg dial-link" href={phone.tel.startsWith('tel:') ? phone.tel : `tel:${phone.phone}`}>
                <IconPhone /> <span className="tnum">{phone.phone}</span>
              </a>
            )}
            <button type="button" className={`btn btn-lg${phone ? '' : ' btn-ink'}`} disabled={!!busy} onClick={() => onDone(item)}>
              {busy === 'done' ? 'Finishing…' : 'Done'}
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={!!busy}
              onClick={() => onRelease(item)}
              data-tip="Hide the number and put them back in the queue at their place"
            >
              {busy === 'release' ? 'Cancelling…' : 'Cancel callback'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" disabled={!!busy} onClick={() => onCallBack(item)}>
            <IconPhone /> {busy === 'call' ? 'Connecting…' : 'Call back'}
          </button>
        )}
      </div>
    </div>
  );
}
