import { useEffect, useMemo, useRef, useState } from 'react';
import { api, apiBase } from './api';
import { Rules } from './components/Rules';
import { Digits } from './components/Digits';
import { QueueRow, type RowFlag } from './components/QueueRow';
import { capitalize, clock, issueSentence } from './format';
import { useNow, usePoll } from './hooks';
import type { QueueResponse } from './types';
import { useFlip } from './useFlip';

const FLAG_MS = 8000;

/** Remembers each caller's last rank so a jump up the queue, or a new arrival, can be called out for a few seconds. */
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

export default function App() {
  const cfgPoll = usePoll(api.config, 30_000);
  const queue = usePoll(api.queue, 1500);
  const profiles = usePoll(api.profiles, 4000);
  const cfg = cfgPoll.data;
  const codes = usePoll(api.codes, 2000, !!cfg?.demoShowCodes);
  const now = useNow(1000);

  const [phones, setPhones] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const flags = useRankFlags(queue.data);

  // Keep timers honest even if this laptop's clock is off: anchor to the server's clock.
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
      const res = await api.claim(id);
      setPhones((p) => ({ ...p, [id]: res.phone }));
      queue.refresh();
    } catch (err) {
      setActionError(`Could not start the callback: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function finish(id: string) {
    setActionError(null);
    try {
      await api.finish(id);
      queue.refresh();
    } catch (err) {
      setActionError(`Could not mark the call done: ${(err as Error).message}`);
    }
  }

  const status =
    queued.length === 0
      ? 'No one is waiting.'
      : `${queued.length} ${queued.length === 1 ? 'caller' : 'callers'} waiting. Longest wait ${clock(longestMs)}.`;

  return (
    <div className="page">
      <header className="top">
        <h1>{cfg ? `${cfg.orgName} priority callbacks` : 'Priority callbacks'}</h1>
        <div className="top-side">
          <p className="status" aria-live="polite">
            {queue.data ? status : 'Connecting…'}
          </p>
          <p className={`live${queue.error ? ' down' : ''}`}>
            <i className="dot" />
            {queue.error ? 'Offline' : 'Live'}
          </p>
        </div>
      </header>

      {queue.error && (
        <p className="banner" role="alert">
          Can't reach the server at {apiBase}. Showing the last data and retrying.
        </p>
      )}
      {actionError && (
        <p className="banner" role="alert">
          {actionError}
        </p>
      )}

      <main className="board">
        <div className="main-col">
          <section aria-labelledby="waiting-h">
            <h2 id="waiting-h">Waiting</h2>
            {queue.data && queued.length === 0 ? (
              <p className="empty">
                Callers appear here as soon as they finish talking to the voice agent, with a brief already written.
              </p>
            ) : (
              <ol className="rows" ref={listRef}>
                {queued.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    nowEst={nowEst}
                    agingPerMin={cfg?.agingPerMin ?? 2}
                    agingCap={cfg?.agingCap ?? 150}
                    scaleMax={scaleMax}
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
              <ul className="plain">
                {inProgress.map((item) => {
                  const phone = phones[item.id];
                  return (
                    <li key={item.id} className="talk">
                      <div>
                        <strong>{item.name ?? 'Unknown caller'}</strong>{' '}
                        <span className="phone">{phone ?? item.phoneMasked}</span>
                        <p className="issue-line">{issueSentence(item)}</p>
                        <p className="brief">{item.summary}</p>
                      </div>
                      <div className="talk-actions">
                        {phone && (
                          <a className="btn primary" href={`tel:${phone}`}>
                            Dial {phone}
                          </a>
                        )}
                        <button type="button" className="btn" onClick={() => finish(item.id)}>
                          Mark done
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section aria-labelledby="done-h">
              <h2 id="done-h">Handled recently</h2>
              <ul className="plain muted-list">
                {done.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name ?? 'Unknown caller'}</strong> {capitalize(item.intentLabel)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="side-col">
          {cfg && <Rules cfg={cfg} />}

          <section aria-labelledby="saved-h">
            <h2 id="saved-h">Saved callers</h2>
            {(profiles.data?.profiles.length ?? 0) === 0 ? (
              <p className="muted">Nobody has saved their details yet.</p>
            ) : (
              <ul className="plain">
                {profiles.data!.profiles.map((p) => (
                  <li key={p.phoneMasked + p.name} className="saved">
                    <span>
                      <strong>{p.name}</strong> <span className="phone">{p.phoneMasked}</span>
                    </span>
                    {nowEst - p.createdAt < 20_000 && <span className="flag">Just saved</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {cfg?.demoShowCodes && (codes.data?.codes.length ?? 0) > 0 && (
            <section aria-labelledby="codes-h" className="codes">
              <h2 id="codes-h">Texted codes</h2>
              <p className="muted">Shown here in case a text does not arrive during the demo.</p>
              <ul className="plain">
                {codes.data!.codes.map((c) => (
                  <li key={c.phone}>
                    <span className="phone">{c.phoneMasked}</span>
                    <span className="code">
                      <Digits text={c.code} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
