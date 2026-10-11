import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, apiBase, errorText } from '../api';
import { useAuth } from '../auth';
import { Detail, type BusyKind } from '../components/Detail';
import { Toast, useToast } from '../components/Toast';
import { Drawer } from '../components/Drawer';
import { IconInfo } from '../components/Icons';
import { InsightsCard } from '../components/Insights';
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
  // Ids ever shown: a cancelled or reopened callback coming back isn't "new".
  const seen = useRef(new Set<string>());
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
        if (was === -1) {
          if (!seen.current.has(id)) add[id] = { kind: 'new', until: Date.now() + FLAG_MS };
        } else if (before.slice(0, was).some((other) => now.indexOf(other) > idx)) add[id] = { kind: 'up', from: was + 1, until: Date.now() + FLAG_MS };
      });
      if (Object.keys(add).length) setFlags((f) => ({ ...f, ...add }));
    }
    prev.current = now;
    now.forEach((id) => seen.current.add(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return flags;
}

const is404 = (e: unknown) => e instanceof ApiError && e.status === 404;

type Local = { status: 'queued' | 'in_progress' | 'done'; item: QueueItemView; at: number };
type Busy = { id: string; kind: BusyKind } | null;
type Filter = 'all' | 'waiting' | 'call';

export default function QueuePage() {
  const { me } = useAuth();
  const org = me?.org;
  const settings = org?.settings;
  const isAdmin = me?.role === 'admin';
  const requireVerification = me?.platform.requireVerification ?? false;
  const queue = usePoll(api.queue, 1500);
  // Texted codes only exist when verification is on; the endpoint 404s otherwise.
  const codes = usePoll(api.codes, 2000, requireVerification, is404);
  const now = useNow(1000);

  // Optimistic moves so Call back / Done respond instantly instead of waiting for the next poll.
  const [local, setLocal] = useState<Record<string, Local>>({});
  const [phones, setPhones] = useState<Record<string, { phone: string; tel: string }>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const { toast, show: showToast, hide: hideToast } = useToast();
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
    const is = (id: string, st: Local['status']) => !local[id] || local[id]!.status === st;
    const sQ = new Set(data.queued.map((i) => i.id));
    const sIP = new Set(data.inProgress.map((i) => i.id));
    const sD = new Set(data.done.map((i) => i.id));
    // Released / reopened callers re-enter at their score's place until the server confirms.
    const back = loc
      .filter((l) => l.status === 'queued' && !sQ.has(l.item.id))
      .map((l) => ({ ...l.item, status: 'queued' as const, claimedAt: null, doneAt: null }));
    let q = data.queued.filter((i) => is(i.id, 'queued'));
    if (back.length) q = [...q, ...back].sort((a, b) => b.score.total - a.score.total);
    const ip = [
      ...data.inProgress.filter((i) => is(i.id, 'in_progress')),
      ...loc.filter((l) => l.status === 'in_progress' && !sIP.has(l.item.id)).map((l) => ({ ...l.item, status: 'in_progress' as const, claimedAt: l.at })),
    ];
    const d = [
      ...loc.filter((l) => l.status === 'done' && !sD.has(l.item.id)).map((l) => ({ ...l.item, status: 'done' as const, doneAt: l.at })),
      ...data.done.filter((i) => is(i.id, 'done')),
    ];
    return { queued: q.map((i, k) => ({ ...i, rank: k + 1 })), inProgress: ip, done: d };
  }, [data, local]);

  // Drop optimistic entries once the server agrees (or after 20 s).
  useEffect(() => {
    if (!data) return;
    setLocal((cur) => {
      const sQ = new Set(data.queued.map((i) => i.id));
      const sIP = new Set(data.inProgress.map((i) => i.id));
      const sD = new Set(data.done.map((i) => i.id));
      let changed = false;
      const next: Record<string, Local> = {};
      for (const [id, l] of Object.entries(cur)) {
        const settled = l.status === 'queued' ? sQ.has(id) : l.status === 'done' ? sD.has(id) : sIP.has(id) || sD.has(id);
        if (settled || Date.now() - l.at > 20_000) {
          changed = true;
          continue;
        }
        next[id] = l;
      }
      return changed ? next : cur;
    });
  }, [data]);

  /** Apply an optimistic move, run the request, roll back and say so if it fails. */
  const move = useCallback(
    async (item: QueueItemView, status: Local['status'], kind: BusyKind, run: () => Promise<unknown>, failText: string) => {
      let prev: Local | undefined;
      setLocal((l) => {
        prev = l[item.id];
        return { ...l, [item.id]: { status, item, at: Date.now() } };
      });
      setBusy({ id: item.id, kind });
      try {
        await run();
        queue.refresh();
        return true;
      } catch (err) {
        setLocal((l) => {
          const next = { ...l };
          if (prev) next[item.id] = prev;
          else delete next[item.id];
          return next;
        });
        showToast({ text: `${failText} ${errorText(err)}`, tone: 'error' });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [queue, showToast],
  );

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

  const firstName = (i: QueueItemView) => i.name?.split(' ')[0] ?? 'The caller';
  /** Your callback, or one from before claims were tracked. Teammates' callbacks are view-only for reps. */
  const mine = (i: QueueItemView) => !i.claimedBy || i.claimedBy.id === data?.me;
  const onlineReps = data?.reps.filter((r) => r.online).length ?? 0;
  const etaReps = onlineReps || settings?.repsOnShift || 1;

  const claim = useCallback(
    async (item: QueueItemView) => {
      setBusy({ id: item.id, kind: 'call' });
      try {
        const res = await api.callback(item.id);
        setPhones((p) => ({ ...p, [item.id]: res }));
        setLocal((l) => ({ ...l, [item.id]: { status: 'in_progress', item, at: Date.now() } }));
        pick(item.id);
        queue.refresh();
      } catch (err) {
        const by = err instanceof ApiError ? (err.body.claimedBy as { name?: string } | null | undefined)?.name : undefined;
        showToast({ text: by ? `${by} is already calling ${firstName(item)}.` : `Could not start the callback. ${errorText(err)}`, tone: 'error' });
        queue.refresh();
      } finally {
        setBusy(null);
      }
    },
    [queue, pick, showToast],
  );

  /** Take next: the server picks the top caller nobody has claimed, so teammates never collide. */
  const [taking, setTaking] = useState(false);
  const takeNext = useCallback(async () => {
    setTaking(true);
    try {
      const res = await api.next();
      if (!res) {
        showToast({ text: 'No one is waiting.' });
        return;
      }
      setPhones((p) => ({ ...p, [res.item.id]: { phone: res.phone, tel: res.tel } }));
      setLocal((l) => ({ ...l, [res.item.id]: { status: 'in_progress', item: res.item, at: Date.now() } }));
      pick(res.item.id);
      setSheetOpen(true);
      queue.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'at_capacity' && typeof err.body.id === 'string') pick(err.body.id);
      showToast({ text: errorText(err), tone: 'error' });
    } finally {
      setTaking(false);
    }
  }, [queue, pick, showToast]);

  const reopen = useCallback(
    async (item: QueueItemView) => {
      const ok = await move(item, 'queued', 'release', () => api.reopen(item.id), 'Could not reopen.');
      if (ok) showToast({ text: `${firstName(item)} is back in the queue.` });
    },
    [move, showToast],
  );

  const finish = useCallback(
    async (item: QueueItemView) => {
      const ok = await move(item, 'done', 'done', () => api.done(item.id), 'Could not mark the call done.');
      if (ok) {
        setPhones(({ [item.id]: _gone, ...rest }) => rest);
        showToast({ text: `${firstName(item)} marked done.`, action: { label: 'Reopen', run: () => void reopen(item) } });
      }
    },
    [move, showToast, reopen],
  );

  const release = useCallback(
    async (item: QueueItemView) => {
      const phone = phones[item.id];
      setPhones(({ [item.id]: _gone, ...rest }) => rest);
      const ok = await move(item, 'queued', 'release', () => api.release(item.id), 'Could not cancel the callback.');
      if (ok) showToast({ text: `Callback cancelled. ${firstName(item)} keeps their place in the queue.` });
      else if (phone) setPhones((p) => ({ ...p, [item.id]: phone }));
    },
    [move, phones, showToast],
  );

  // Keyboard: up/down moves the selection, Enter calls back. Instant, no animation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape' && sheetOpen) {
        setSheetOpen(false);
        return;
      }
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
  }, [order, selected, busy, claim, rulesOpen, pick, sheetOpen]);

  const firstVisibleId = filter === 'waiting' ? queued[0]?.id : filter === 'call' ? inProgress[0]?.id : (inProgress[0] ?? queued[0])?.id;

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
        <PageHeader title={`${greeting()}, ${org?.name ?? 'there'}`} sentence={sentence} right={<ReadyPill offline={!!queue.error} reps={data ? { online: onlineReps, available: data.availableReps } : undefined} />} />

        {queue.error && (
          <p className="banner" role="alert">
            {queue.error instanceof ApiError && queue.error.code !== 'network'
              ? `Server error: ${errorText(queue.error)}`
              : `Can't reach ${apiBase}. Retrying.`}
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
              <button type="button" className="btn btn-primary take-next" disabled={taking || !queued.length} onClick={() => void takeNext()}>
                {taking ? 'Taking…' : 'Take next'}
              </button>
              <label className="pill-select">
                <span className="sr">Show</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                  <option value="all">All · {queued.length + inProgress.length}</option>
                  <option value="waiting">Waiting · {queued.length}</option>
                  <option value="call">On a call · {inProgress.length}</option>
                </select>
              </label>
              <button type="button" className="icon-btn rules-btn" onClick={() => setRulesOpen(true)} aria-label="How ranking works" data-tip="How ranking works">
                <IconInfo />
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
                {filter !== 'waiting' && calls.length > 0 && (
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
                        mine={mine(item)}
                        onSelect={(id) => {
                          pick(id);
                          setSheetOpen(true);
                        }}
                      />
                    ))}
                  </ul>
                )}
                <ol className="list" ref={listRef} aria-label="Waiting, highest priority first" hidden={filter === 'call'}>
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
                {filter !== 'call' && rows.length === 0 && <p className="list-clear muted">No one else waiting.</p>}
                {filter === 'call' && calls.length === 0 && <p className="list-clear muted">No one on a call.</p>}
              </>
            )}
          </section>

          <button type="button" className="sheet-backdrop" aria-label="Close details" tabIndex={-1} onClick={() => setSheetOpen(false)} />
          <div className="md-detail">
          <h2 className="md-detail-title">Caller brief</h2>
          <section className={`detail card-sel${selected && selected.id === firstVisibleId ? ' join-top' : ''}`} aria-label="Caller brief" aria-live="polite">
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
                  etaMin={Math.max(1, Math.ceil(((selected.rank ?? 1) * (settings?.avgHandleMin ?? 4)) / etaReps))}
                  teammate={mine(selected) ? undefined : selected.claimedBy?.name}
                  canManage={isAdmin || mine(selected)}
                  busy={busy?.id === selected.id ? busy.kind : null}
                  onCallBack={claim}
                  onDone={finish}
                  onRelease={release}
                  onClose={() => setSheetOpen(false)}
                />
              </div>
            ) : (
              <div className="detail-empty">
                <p className="muted">Briefs appear here when someone calls.</p>
              </div>
            )}
          </section>
          </div>
        </div>
      </div>

      <aside className={`q-rail${requireVerification ? '' : ' is-solo'}`} aria-label="Today">
        {requireVerification && codes.data && !is404(codes.error) && <CodesCard codes={codes.data.codes} nowEst={nowEst} />}
        <InsightsCard />
        {data ? <Timeline items={[...queued, ...inProgress, ...done]} requireVerification={requireVerification} onReopen={(id) => {
              const it = done.find((d) => d.id === id);
              if (it) void reopen(it);
            }} /> : <div className="card sk-card" />}
      </aside>

      <Toast toast={toast} onHide={hideToast} />
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
