import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, apiBase, errorText } from '../api';
import { useAuth } from '../auth';
import { Digits } from '../components/Digits';
import { QueueRow, Transcript, type RowFlag } from '../components/QueueRow';
import { Rules } from '../components/Rules';
import { ago, clock, issueSentence, usd } from '../format';
import { useNow, usePoll } from '../hooks';
import type { OrgSettings, QueueItemView, QueueResponse } from '../types';
import { useFlip } from '../useFlip';

const FLAG_MS = 8000;

/** Remembers each caller's last rank so a jump up the queue, or a new arrival, is called out for a few seconds. */
function useRankFlags(data: QueueResponse | undefined): Record<string, RowFlag> {
  const prev = useRef<Map<string, number> | null>(null);
  const [flags, setFlags] = useState<Record<string, RowFlag>>({});

  useEffect(() => {
    if (!data) return;
    const before = prev.current;
    if (before) {
      const add: Record<string, RowFlag> = {};
      for (const item of data.queued) {
        const was = before.get(item.id);
        const rank = item.rank ?? 0;
        if (was === undefined) add[item.id] = { kind: 'new', until: Date.now() + FLAG_MS };
        else if (rank < was) add[item.id] = { kind: 'up', from: was, until: Date.now() + FLAG_MS };
      }
      if (Object.keys(add).length) setFlags((f) => ({ ...f, ...add }));
    }
    prev.current = new Map(data.queued.map((i) => [i.id, i.rank ?? 0]));
  }, [data]);

  return flags;
}

const is404 = (e: unknown) => e instanceof ApiError && e.status === 404;

export default function QueuePage() {
  const { me } = useAuth();
  const settings = me?.org?.settings;
  const queue = usePoll(api.queue, 1500);
  const profiles = usePoll(api.profiles, 5000);
  const codes = usePoll(api.codes, 2000, true, is404);
  const now = useNow(1000);

  const [phones, setPhones] = useState<Record<string, { phone: string; tel: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const flags = useRankFlags(queue.data);

  // Anchor clocks to the server's clock so a skewed laptop clock doesn't lie.
  const nowEst = now + (queue.data ? queue.data.now - queue.fetchedAt : 0);

  const queued = queue.data?.queued ?? [];
  const inProgress = queue.data?.inProgress ?? [];
  const done = queue.data?.done ?? [];
  const scaleMax = Math.max(150, ...queued.map((i) => i.score.total + 20));

  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef, queued.map((i) => i.id).join(','));

  const longestMs = useMemo(
    () => (queued.length ? Math.max(...queued.map((i) => nowEst - i.createdAt)) : 0),
    [queued, nowEst],
  );

  async function claim(id: string) {
    setBusy(id);
    setActionError(null);
    try {
      const res = await api.callback(id);
      setPhones((p) => ({ ...p, [id]: res }));
      queue.refresh();
    } catch (err) {
      setActionError(`Could not start the callback. ${errorText(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function finish(id: string) {
    setActionError(null);
    try {
      await api.done(id);
      queue.refresh();
    } catch (err) {
      setActionError(`Could not mark the call done. ${errorText(err)}`);
    }
  }

  const agingPerMin = settings?.agingPerMin ?? 2;
  const agingCap = settings?.agingCap ?? 150;
  const handle = settings?.avgHandleMin ?? 4;
  const reps = Math.max(1, settings?.repsOnShift ?? 1);
  const eta = (rank: number | null) => Math.max(1, Math.ceil(((rank ?? 1) * handle) / reps));

  const status = !queue.data
    ? queue.error
      ? 'Waiting for the server…'
      : 'Connecting…'
    : queued.length === 0
      ? 'No one is waiting.'
      : `${queued.length} ${queued.length === 1 ? 'caller' : 'callers'} waiting · longest ${clock(longestMs)}`;

  return (
    <div className="page">
      <div className="board-head">
        <h1 className="board-title">Callbacks</h1>
        <p className="board-status" aria-live="polite">
          <span className={`live${queue.error ? ' down' : ''}`}>
            <i className="dot" aria-hidden="true" />
            {queue.error ? 'Offline' : 'Live'}
          </span>
          <span className="tnum">{status}</span>
        </p>
      </div>

      {queue.error && (
        <p className="banner" role="alert">
          {queue.error instanceof ApiError && queue.error.code !== 'network'
            ? `The server returned an error: ${errorText(queue.error)}`
            : `Can't reach the server at ${apiBase}. Showing the last data and retrying.`}
        </p>
      )}
      {actionError && (
        <p className="banner" role="alert">
          {actionError}
        </p>
      )}

      {queue.data && <Stats data={queue.data} longestMs={longestMs} />}

      <div className="board">
        <div className="main-col">
          <section aria-labelledby="waiting-h">
            <h2 id="waiting-h">Waiting</h2>
            {queue.data && queued.length === 0 ? (
              <div className="empty">
                <p className="empty-big">Nobody on hold.</p>
                <p>
                  Callers appear here the moment they finish talking to the voice agent, ranked, with a brief already
                  written. {me?.org?.dialNumber ? `Call ${me.org.dialNumber} to try it.` : 'Claim a number in Setup to start taking calls.'}
                </p>
              </div>
            ) : (
              <ol className="rows" ref={listRef}>
                {queued.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    nowEst={nowEst}
                    agingPerMin={agingPerMin}
                    agingCap={agingCap}
                    scaleMax={scaleMax}
                    etaMin={eta(item.rank)}
                    flag={flags[item.id]}
                    busy={busy === item.id}
                    onClaim={claim}
                  />
                ))}
              </ol>
            )}
          </section>

          {inProgress.length > 0 && (
            <section aria-labelledby="talk-h">
              <h2 id="talk-h">On a call</h2>
              <ul className="talks">
                {inProgress.map((item) => (
                  <InProgress key={item.id} item={item} phone={phones[item.id]} nowEst={nowEst} onDone={finish} />
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section aria-labelledby="done-h">
              <h2 id="done-h">Handled recently</h2>
              <ul className="done-list">
                {done.map((item) => (
                  <li key={item.id}>
                    <span className="done-name">{item.name ?? 'Unknown caller'}</span>
                    <span className="muted">{issueSentence(item)}</span>
                    <span className="done-saved tnum">{item.savedMin} min returned</span>
                    <span className="muted tnum">{item.doneAt ? ago(nowEst - item.doneAt) : ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="side-col">
          {queue.data && <TimeSaved t={queue.data.timeSaved} />}

          {codes.data && !is404(codes.error) && (
            <section aria-labelledby="codes-h" className="panel codes">
              <h2 id="codes-h">Texted codes</h2>
              <p className="muted">Demo fallback, in case a text doesn't arrive on stage.</p>
              {codes.data.codes.length === 0 ? (
                <p className="muted">No codes sent yet.</p>
              ) : (
                <ul>
                  {codes.data.codes.map((c) => (
                    <li key={c.phoneMasked + c.code}>
                      <span className="phone tnum">{c.phoneMasked}</span>
                      <span className="code">
                        <Digits text={c.code} />
                      </span>
                      <span className="muted tnum">
                        {c.expiresAt > nowEst ? `expires in ${clock(c.expiresAt - nowEst)}` : 'expired'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {settings && <Rules settings={settings} />}

          {settings && <Capacity settings={settings} />}

          <section aria-labelledby="saved-h" className="panel">
            <h2 id="saved-h">Remembered callers</h2>
            {(profiles.data?.profiles.length ?? 0) === 0 ? (
              <p className="muted">Nobody has saved their details yet.</p>
            ) : (
              <ul className="saved-list">
                {profiles.data!.profiles.map((p) => (
                  <li key={p.phoneMasked + p.name}>
                    <span>
                      <strong>{p.name}</strong> <span className="phone tnum">{p.phoneMasked}</span>
                    </span>
                    <span className={`trust trust-${p.verified ? 'verified' : 'new'}`}>
                      {p.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stats({ data, longestMs }: { data: QueueResponse; longestMs: number }) {
  const s = data.stats;
  return (
    <dl className="stats">
      <div>
        <dt>Waiting</dt>
        <dd className="tnum">{s.waiting}</dd>
      </div>
      <div>
        <dt>On a call</dt>
        <dd className="tnum">{s.inProgress}</dd>
      </div>
      <div>
        <dt>Longest wait</dt>
        <dd className="tnum">{data.queued.length ? clock(longestMs) : `${s.longestWaitMin}m`}</dd>
      </div>
      <div>
        <dt>Average wait</dt>
        <dd className="tnum">{s.avgWaitMin}m</dd>
      </div>
    </dl>
  );
}

function TimeSaved({ t }: { t: QueueResponse['timeSaved'] }) {
  return (
    <section aria-labelledby="saved-time-h" className="panel time-saved">
      <h2 id="saved-time-h" className="eyebrow">
        Time returned today
      </h2>
      <p className="ts-big tnum">
        {t.totalMin.toLocaleString('en-US')}
        <span className="ts-unit">min</span>
      </p>
      <p className="ts-sub tnum">
        given back to {t.callers} {t.callers === 1 ? 'caller' : 'callers'}
        {t.returningCallers > 0 ? `, ${t.returningCallers} returning` : ''}
      </p>
      <p className="ts-formula">{t.formula}</p>
      <p className="ts-math tnum">
        {t.callers} × {t.baselineHoldMin} + {t.returningCallers} × {t.reexplainMin} ={' '}
        {t.callers * t.baselineHoldMin + t.returningCallers * t.reexplainMin} min
      </p>
    </section>
  );
}

function Capacity({ settings }: { settings: OrgSettings }) {
  return (
    <section aria-labelledby="cap-h" className="panel">
      <h2 id="cap-h">Callback estimate</h2>
      <p>
        <span className="tnum">{settings.repsOnShift}</span> {settings.repsOnShift === 1 ? 'rep' : 'reps'} on shift, about{' '}
        <span className="tnum">{settings.avgHandleMin}</span> min per call. Rank × handle time ÷ reps.
      </p>
    </section>
  );
}

function InProgress({
  item,
  phone,
  nowEst,
  onDone,
}: {
  item: QueueItemView;
  phone?: { phone: string; tel: string };
  nowEst: number;
  onDone: (id: string) => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  return (
    <li className={`talk tier-${item.tier}`}>
      <div className="talk-body">
        <p className="who">
          <strong className="name">{item.name ?? 'Unknown caller'}</strong>
          <span className="phone tnum">{phone?.phone ?? item.phoneMasked}</span>
        </p>
        <p className="issue">
          <span className="tier-word">{item.tierLabel}</span>
          <span className="intent">{item.intentLabel}</span>
          {item.amountUsd != null && <span className="amount tnum">{usd(item.amountUsd)}</span>}
        </p>
        <p className="brief">{item.summary}</p>
        {item.hasTranscript && (
          <button type="button" className="link-btn" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
        )}
        {showTranscript && <Transcript id={item.id} />}
      </div>
      <div className="talk-actions">
        {item.claimedAt && <span className="muted tnum">on call {clock(nowEst - item.claimedAt)}</span>}
        {phone && (
          <a className="btn btn-primary" href={phone.tel.startsWith('tel:') ? phone.tel : `tel:${phone.phone}`}>
            Dial {phone.phone}
          </a>
        )}
        <button type="button" className="btn" onClick={() => onDone(item.id)}>
          Done
        </button>
      </div>
    </li>
  );
}
