import { useState } from 'react';
import { capitalize, clock, trustClass, trustLabel, usd } from '../format';
import { useAuth } from '../auth';
import { useCountUp } from '../hooks';
import type { QueueItemView } from '../types';
import { Digits } from './Digits';
import { IconClose, IconPhone } from './Icons';
import { Avatar, Transcript, liveAging } from './QueueRow';
import { ScoreBar } from './ScoreBar';


interface Props {
  item: QueueItemView;
  nowEst: number;
  agingPerMin: number;
  agingCap: number;
  scaleMax: number;
  phone?: { phone: string; tel: string };
  busy: boolean;
  onCallBack: (item: QueueItemView) => void;
  onDone: (item: QueueItemView) => void;
  onClose: () => void;
}

/** The selected caller's brief. Keyed by id so a selection change crossfades. */
export function Detail({ item, nowEst, agingPerMin, agingCap, scaleMax, phone, busy, onCallBack, onDone, onClose }: Props) {
  const [showTranscript, setShowTranscript] = useState(false);
  const requireVerification = useAuth().me?.platform.requireVerification ?? false;
  const inCall = item.status === 'in_progress';
  const aging = liveAging(item, nowEst, agingPerMin, agingCap);
  const { urgency, value } = item.score;
  const total = useCountUp(urgency + value + Math.floor(aging), 500);

  return (
    <div className={`detail-body tier-${item.tier}`}>
      <button type="button" className="icon-btn detail-close" aria-label="Close" onClick={onClose}>
        <IconClose />
      </button>
      <div className="detail-head">
        <Avatar item={item} size="lg" />
        <div className="detail-who">
          <p className="eyebrow">{inCall ? 'On a call' : `Rank #${item.rank}`}</p>
          <h2 className="detail-name">{item.name ?? 'Unknown caller'}</h2>
          <p className="detail-phone tnum">
            {phone ? (
              <span className="revealed">{phone.phone}</span>
            ) : (
              item.phoneMasked
            )}
            <span className={`chip chip-trust trust-${trustClass(item.trust, requireVerification)}`}>{trustLabel(item.trust, requireVerification)}</span>
          </p>
        </div>
      </div>

      <div className="chips">
        <span className={`chip chip-tier tier-${item.tier}`}>
          <i className="tier-dot" aria-hidden="true" />
          {item.tierLabel}
        </span>
        <span className="chip">{capitalize(item.intentLabel)}</span>
        {item.amountUsd != null && <span className="chip tnum">{usd(item.amountUsd)}</span>}
        {item.returning && <span className="chip">Returning</span>}
      </div>

      <p className="detail-brief">{item.summary}</p>

      <div className="detail-score" data-tip={item.reason}>
        <div className="score-top">
          <span className="eyebrow">Priority</span>
          <span className="score-total tnum">{total}</span>
        </div>
        <ScoreBar urgency={urgency} value={value} aging={aging} scaleMax={scaleMax} label={item.reason} />
        <p className="legend tnum">
          <span>
            <i className="sw sw-urgency" /> Urgency {urgency}
          </span>
          <span>
            <i className="sw sw-value" /> Value {value}
          </span>
          <span>
            <i className="sw sw-aging" /> Waiting {Math.floor(aging)}
          </span>
        </p>
      </div>

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
            {phone ? (
              <a className="btn btn-primary btn-lg dial-link" href={phone.tel.startsWith('tel:') ? phone.tel : `tel:${phone.phone}`}>
                <IconPhone /> <span className="tnum">{phone.phone}</span>
              </a>
            ) : (
              <span className="muted tnum">
                On call <Digits text={clock(nowEst - (item.claimedAt ?? nowEst))} />
              </span>
            )}
            <button type="button" className="btn btn-lg" disabled={busy} onClick={() => onDone(item)}>
              {busy ? 'Finishing…' : 'Done'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => onCallBack(item)}>
              <IconPhone /> {busy ? 'Connecting…' : 'Call back'}
            </button>
            <span className="muted tnum wait-inline">
              waiting <Digits text={clock(nowEst - item.createdAt)} />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
