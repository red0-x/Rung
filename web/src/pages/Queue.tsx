import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, apiBase, errorText } from '../api';
import { useAuth } from '../auth';
import { Detail } from '../components/Detail';
import { Drawer } from '../components/Drawer';
import { IconInfo } from '../components/Icons';
import { ListRow, type RowFlag } from '../components/QueueRow';
import { CodesCard, Timeline } from '../components/Rail';
import { Rules } from '../components/Rules';
import { PageHeader, ReadyPill, greeting } from '../components/Shell';
import { NextTile, TimeTile, UrgencyTile, WaitingTile } from '../components/Tiles';
import { BrandLogo } from '../components/BrandLogo';
import { useNow, usePoll, usePresence } from '../hooks';
import type { QueueItemView } from '../types';
import { useFlip } from '../useFlip';

const FLAG_MS = 8000;
const EXIT_MS = 280;

/**
 * Flags a new arrival, or a caller who overtook someone still waiting, for a few seconds.
 * Moving up because the person ahead was called back is not news, so it isn't flagged.
 */
function useRankFlags(queued: QueueItemView[] | undefined): Record<string, RowFlag> {
  const prev = useRef<string[] | null>(null);
  const [flags, setFlags] = useState<Record<string, RowFlag>>({});
  const key = queued?.map((i) => i.id).join(',');

  useEffect(() => {
    if (!queued) return;
    const before = prev.current;
    const now = queued.map((i) => i.id);
    if (before) {
      const add: Record<string, RowFlag> = {};
      now.forEach((id, idx) => {
        const was = before.indexOf(id);
        if (was === -1) add[id] = { kind: 'new', until: Date.now() + FLAG_MS };
        else if (before.slice(0, was).some((other) => now.indexOf(other) > idx)) add[id] = { kind: 'up', from: was + 1, until: Date.now() + FLAG_MS };
      });
      if (Object.keys(add).length) setFlags((f) => ({ ...f, ...add }));
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return flags;
}

const is404 = (e: unknown) => e instanceof ApiError && e.status === 404;

type Local = { status: 'in_progress' | 'done'; item: QueueItemView; at: number };

export default function QueuePage() {
  const { me } = useAuth();
  const org = me?.org;
  const settings = org?.settings;
  const queue = usePoll(api.queue, 1500);
  const codes = usePoll(api.codes, 2000, true, is404);
  const now = useNow(1000);

  // Optimistic moves so Call back / Done respond instantly instead of waiting for the next poll.
  const [local, setLocal] = useState<Record<string, Local>>({});
  const [phones, setPhones] = useState<Record<string, { phone: string; tel: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Until someone picks a caller, the brief follows whoever is #1.
  const [pinned, setPinned] = useState(false);
  const pick = useCallback((id: string) => {
    setSelectedId(id);
    setPinned(true);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const data = queue.data;
  // Anchor clocks to the server's clock so a skewed laptop clock doesn't lie.
  const nowEst = now + (data ? data.now - queue.fetchedAt : 0);

  const { queued, inProgress, done } = useMemo(() => {
    if (!data) return { queued: [] as QueueItemView[], inProgress: [] as QueueItemView[], done: [] as QueueItemView[] };
    const loc = Object.values(local);
    const q = data.queued.filter((i) => !local[i.id]).map((i, k) => ({ ...i, rank: k + 1 }));
    const settled = new Set([...data.inProgress, ...data.done].map((i) => i.id));
    const ip = [
      ...data.inProgress.filter((i) => local[i.id]?.status !== 'done'),
      ...loc.filter((l) => l.status === 'in_progress' && !settled.has(l.item.id)).map((l) => ({ ...l.item, status: 'in_progress' as const, claimedAt: l.at })),
    ];
    const doneIds = new Set(data.done.map((i) => i.id));
    const d = [
      ...loc.filter((l) => l.status === 'done' && !doneIds.has(l.item.id)).map((l) => ({ ...l.item, status: 'done' as const, doneAt: l.at })),
      ...data.done,
    ];
    return { queued: q, inProgress: ip, done: d };
  }, [data, local]);

  // Drop optimistic entries once the server agrees (or after 20 s).
  useEffect(() => {
    if (!data) return;
    setLocal((cur) => {
      const ip = new Set(data.inProgress.map((i) => i.id));
      const dn = new Set(data.done.map((i) => i.id));
      let changed = false;
      const next: Record<string, Local> = {};
      for (const [id, l] of Object.entries(cur)) {
        const settled = l.status === 'done' ? dn.has(id) : ip.has(id) || dn.has(id);
        if (settled || Date.now() - l.at > 20_000) {
          changed = true;
          continue;
        }
        next[id] = l;
      }
      return changed ? next : cur;
    });
  }, [data]);

  const flags = useRankFlags(data ? queued : undefined);
  const rows = usePresence(queued, (i) => i.id, EXIT_MS);
  const calls = usePresence(inProgress, (i) => i.id, EXIT_MS);
  const scaleMax = Math.max(150, ...[...queued, ...inProgress].map((i) => i.score.total + 20));

  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef, queued.map((i) => i.id).join(','));

  // Selection: stable across polls and reorders; falls back to #1 when the selected caller leaves.
  const order = useMemo(() => [...inProgress, ...queued], [inProgress, queued]);
  const held = order.find((i) => i.id === selectedId);
  const selected = (pinned ? held : undefined) ?? queued[0] ?? held ?? inProgress[0];
  useEffect(() => {
    if (selectedId && !held && pinned) setPinned(false);
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId, held, pinned]);

  const claim = useCallback(
    async (item: QueueItemView) => {
      setBusy(item.id);
      setActionError(null);
      try {
        const res = await api.callback(item.id);
        setPhones((p) => ({ ...p, [item.id]: res }));
        setLocal((l) => ({ ...l, [item.id]: { status: 'in_progress', item, at: Date.now() } }));
        pick(item.id);
        queue.refresh();
      } catch (err) {
        setActionError(`Could not start the callback. ${errorText(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [queue, pick],
  );

  const finish = useCallback(
    async (item: QueueItemView) => {
      setBusy(item.id);
      setActionError(null);
      try {
        await api.done(item.id);
        setLocal((l) => ({ ...l, [item.id]: { status: 'done', item, at: Date.now() } }));
        queue.refresh();
      } catch (err) {
        setActionError(`Could not mark the call done. ${errorText(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [queue],
  );

  // Keyboard: up/down moves the selection, Enter calls back. Instant, no animation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable]') || rulesOpen)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!order.length) return;
        e.preventDefault();
        const idx = Math.max(0, order.findIndex((i) => i.id === selected?.id));
        const next = order[Math.min(order.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))]!;
        pick(next.id);
        document.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && !(t && t.closest('button, a'))) {
        if (selected && selected.status === 'queued' && !busy) {
          e.preventDefault();
          void claim(selected);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, selected, busy, claim, rulesOpen, pick]);

  const longestMin = queued.length ? Math.floor(Math.max(...queued.map((i) => nowEst - i.createdAt)) / 60_000) : 0;
  const sentence = !data
    ? ' '
    : queued.length === 0
      ? inProgress.length
        ? `No one waiting. ${inProgress.length} on a call.`
        : 'No one waiting. Your queue is clear.'
      : `${queued.length} ${queued.length === 1 ? 'caller' : 'callers'} waiting. Longest wait ${longestMin < 1 ? 'under a minute' : `${longestMin} min`}.`;

  const agingPerMin = settings?.agingPerMin ?? 2;
  const agingCap = settings?.agingCap ?? 150;

  return (
    <div className="queue-page">
      <div className="q-main">
        <PageHeader title={`${greeting()}, ${org?.name ?? 'there'}`} sentence={sentence} right={<ReadyPill offline={!!queue.error} />} />

        {queue.error && (
          <p className="banner" role="alert">
            {queue.error instanceof ApiError && queue.error.code !== 'network'
              ? `Server error: ${errorText(queue.error)}`
              : `Can't reach ${apiBase}. Retrying.`}
          </p>
        )}
        {actionError && (
          <p className="banner" role="alert">
            {actionError}
          </p>
        )}

        <div className="tiles">
          {data ? (
            <>
              <TimeTile t={data.timeSaved} />
              <WaitingTile queued={queued} nowEst={nowEst} />
              <UrgencyTile queued={queued} />
              <NextTile next={queued[0]} nowEst={nowEst} settings={settings} baselineHoldMin={data.timeSaved.baselineHoldMin} />
            </>
          ) : (
            [0, 1, 2, 3].map((i) => <div key={i} className={`tile sk-tile${i === 0 ? ' tile-cobalt' : ''}`} />)
          )}
        </div>

        <div className={`md${sheetOpen ? ' sheet-open' : ''}`}>
          <section className="md-list" aria-labelledby="list-h">
            <div className="section-head">
              <h2 id="list-h">Callback queue</h2>
              <button type="button" className="ghost-btn" onClick={() => setRulesOpen(true)}>
                <IconInfo /> How ranking works
              </button>
            </div>

            {!data ? (
              <ListSkeleton />
            ) : order.length === 0 && rows.length === 0 && calls.length === 0 ? (
              <div className="empty">
                <span className="empty-mark" aria-hidden="true">
                  <BrandLogo collapsed size={44} />
                </span>
                <p className="empty-title">No one waiting.</p>
                <p className="muted">Your queue is clear.</p>
              </div>
            ) : (
              <>
                {calls.length > 0 && (
                  <ul className="list calls" aria-label="On a call">
                    {calls.map(({ item, key, leaving }) => (
                      <ListRow
                        key={key}
                        item={item}
                        nowEst={nowEst}
                        agingPerMin={agingPerMin}
                        agingCap={agingCap}
                        selected={selected?.id === item.id}
                        leaving={leaving}
                        onSelect={(id) => {
                          pick(id);
                          setSheetOpen(true);
                        }}
                      />
                    ))}
                  </ul>
                )}
                <ol className="list" ref={listRef} aria-label="Waiting, highest priority first">
                  {rows.map(({ item, key, leaving }) => (
                    <ListRow
                      key={key}
                      item={item}
                      nowEst={nowEst}
                      agingPerMin={agingPerMin}
                      agingCap={agingCap}
                      flag={flags[item.id]}
                      selected={selected?.id === item.id}
                      leaving={leaving}
                      onSelect={(id) => {
                        pick(id);
                        setSheetOpen(true);
                      }}
                    />
                  ))}
                </ol>
                {rows.length === 0 && <p className="list-clear muted">No one else waiting.</p>}
              </>
            )}
          </section>

          <button type="button" className="sheet-backdrop" aria-label="Close details" tabIndex={-1} onClick={() => setSheetOpen(false)} />
          <section className="detail card-sel" aria-label="Caller brief" aria-live="polite">
            {!data ? (
              <DetailSkeleton />
            ) : selected ? (
              <div key={selected.id} className="detail-fade">
                <Detail
                  item={selected}
                  nowEst={nowEst}
                  agingPerMin={agingPerMin}
                  agingCap={agingCap}
                  scaleMax={scaleMax}
                  phone={phones[selected.id]}
                  busy={busy === selected.id}
                  onCallBack={claim}
                  onDone={finish}
                  onClose={() => setSheetOpen(false)}
                />
              </div>
            ) : (
              <div className="detail-empty">
                <p className="eyebrow">Caller brief</p>
                <p className="muted">Briefs appear here when someone calls.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <aside className="q-rail" aria-label="Today">
        {codes.data && !is404(codes.error) && <CodesCard codes={codes.data.codes} nowEst={nowEst} />}
        {data ? <Timeline items={[...queued, ...inProgress, ...done]} /> : <div className="card sk-card" />}
      </aside>

      <Drawer open={rulesOpen} title="How ranking works" onClose={() => setRulesOpen(false)}>
        {settings && <Rules settings={settings} />}
      </Drawer>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ol className="list" aria-busy="true" aria-label="Loading queue">
      {[0, 1, 2].map((i) => (
        <li key={i} className="lrow-wrap">
          <div className="lrow sk-row" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="sk sk-rank" />
            <span className="sk sk-avatar" />
            <span className="lrow-main">
              <span className="sk sk-name" />
              <span className="sk sk-line" />
            </span>
            <span className="sk sk-pill" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function DetailSkeleton() {
  return (
    <div className="detail-body" aria-busy="true">
      <div className="detail-head">
        <span className="sk sk-avatar-lg" />
        <div className="detail-who">
          <span className="sk sk-name" />
          <span className="sk sk-line" />
        </div>
      </div>
      <span className="sk sk-para" />
      <span className="sk sk-bar" />
    </div>
  );
}
