import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errorText } from '../api';
import { IntentIcon } from '../components/Icons';
import { PageHeader, initials } from '../components/Shell';
import { Toast, useToast } from '../components/Toast';
import { ago, capitalize, usd } from '../format';
import { useNow, usePoll } from '../hooks';
import { navigate } from '../router';
import type { CallerRow, QueueItemView } from '../types';

type Tab = 'callers' | 'history';

/** CallerRow carries the label, not the intent key; map common labels to an icon. */
function intentFromLabel(label: string | null): string {
  const l = (label ?? '').toLowerCase();
  if (l.includes('fraud')) return 'fraud_in_progress';
  if (l.includes('medical')) return 'medical_emergency';
  if (l.includes('lock')) return 'locked_out';
  if (l.includes('payment') || l.includes('card')) return l.includes('dispute') ? 'dispute' : 'payment_issue';
  if (l.includes('dispute')) return 'dispute';
  if (l.includes('moving') || l.includes('transfer') || l.includes('money')) return 'money_movement';
  if (l.includes('change')) return 'account_change';
  if (l.includes('new account') || l.includes('open')) return 'account_opening';
  if (l.includes('question')) return 'general_question';
  return 'other';
}

const dateFmt = (t: number) => new Date(t).toLocaleDateString([], { day: '2-digit', month: 'short' });
const timeFmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function when(t: number, now: number) {
  return now - t < 24 * 3600_000 ? `Today, ${timeFmt(t)}` : `${dateFmt(t)}, ${timeFmt(t)}`;
}
const mins = (ms: number) => (ms < 60_000 ? '<1 min' : `${Math.round(ms / 60_000)} min`);

function callerStatus(c: CallerRow): { label: string; cls: string } {
  if (c.openStatus === 'in_progress') return { label: 'On a call', cls: 'st-call' };
  if (c.openStatus === 'queued') return { label: 'Waiting', cls: 'st-wait' };
  if (c.saved) return { label: 'Saved', cls: 'st-saved' };
  return { label: 'New', cls: 'st-new' };
}

export default function CallersPage() {
  const callers = usePoll(api.callers, 8000);
  const history = usePoll(() => api.history(100), 8000);
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab>('callers');
  const [q, setQ] = useState('');
  const [reopened, setReopened] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { toast, show, hide } = useToast();

  const needle = q.trim().toLowerCase();
  const cList = useMemo(
    () =>
      (callers.data?.callers ?? []).filter(
        (c) => !needle || [c.name, c.lastIntentLabel, c.lastSummary, c.phoneMasked].some((v) => v?.toLowerCase().includes(needle)),
      ),
    [callers.data, needle],
  );
  const hList = useMemo(
    () =>
      (history.data?.items ?? [])
        .filter((i) => !reopened.has(i.id))
        .filter((i) => !needle || [i.name, i.intentLabel, i.summary, i.phoneMasked].some((v) => v?.toLowerCase().includes(needle))),
    [history.data, reopened, needle],
  );
  const cCount = callers.data?.callers.length;
  const hCount = history.data ? history.data.items.filter((i) => !reopened.has(i.id)).length : undefined;

  async function reopen(item: QueueItemView) {
    setBusy(item.id);
    setReopened((s) => new Set(s).add(item.id));
    try {
      await api.reopen(item.id);
      show({ text: `${item.name?.split(' ')[0] ?? 'The caller'} is back in the queue.` });
      history.refresh();
      callers.refresh();
    } catch (err) {
      setReopened((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
      show({ text: `Could not reopen. ${errorText(err)}`, tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  const active = tab === 'callers' ? callers : history;
  const failed = active.error && !active.data;

  function find(text: string, to: Tab) {
    setQ(text);
    setTab(to);
    setSearchOpen(true);
  }

  return (
    <div className="page-pad">
      <PageHeader title="Callers" sentence="Everyone who has called, and every callback you've finished." />
      <section className="pcard">
        <div className="pcard-head">
          <h2>{tab === 'callers' ? 'Caller list' : 'Callback history'}</h2>
          <div className="pcard-tools">
            <div className={`psearch${searchOpen || q ? ' is-open' : ''}`}>
              <button
                type="button"
                className="round-btn"
                aria-label="Search"
                aria-expanded={searchOpen || !!q}
                onClick={() => {
                  setSearchOpen((o) => !o);
                  setTimeout(() => searchRef.current?.focus(), 0);
                }}
              >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l4 4" />
                </svg>
              </button>
              <input
                ref={searchRef}
                type="search"
                placeholder="Name, issue or phone"
                aria-label="Search callers"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQ('');
                    setSearchOpen(false);
                  }
                }}
                tabIndex={searchOpen || q ? 0 : -1}
              />
            </div>
            <div className="ptabs" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={tab === 'callers'} className="ptab" onClick={() => setTab('callers')}>
                Callers <span className="tnum">{cCount ?? ''}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === 'history'} className="ptab" onClick={() => setTab('history')}>
                History <span className="tnum">{hCount ?? ''}</span>
              </button>
            </div>
          </div>
        </div>

        {failed ? (
          <div className="t-empty">
            <p className="form-error">{errorText(active.error)}</p>
            <button type="button" className="btn" onClick={() => active.refresh()}>
              Retry
            </button>
          </div>
        ) : !active.data ? (
          <TableSkeleton />
        ) : tab === 'callers' ? (
          cList.length === 0 ? (
            <Empty text={needle ? `No callers match "${q}".` : 'No one has called yet.'} />
          ) : (
            <div className="prows prows-callers" role="table" aria-label="Callers">
              <div className="prow-head" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">Caller</span>
                <span role="columnheader">Last call</span>
                <span role="columnheader">Last issue</span>
                <span role="columnheader" className="num">
                  Calls
                </span>
                <span role="columnheader" className="num">
                  Amount
                </span>
                <span role="columnheader">Status</span>
                <span role="columnheader" className="sr">
                  Actions
                </span>
              </div>
              <ul>
                {cList.map((c, idx) => {
                  const st = callerStatus(c);
                  return (
                    <li key={c.key} className={`prow${menu === c.key ? ' is-open' : ''}`} role="row" style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}>
                      <span className="p-idx tnum" role="cell">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="p-who" role="cell">
                        <span className={`p-av tier-${c.lastTier ?? 'low'}`} aria-hidden="true">
                          {c.name ? initials(c.name) : '?'}
                        </span>
                        <span className="p-who-main">
                          <b className={c.name ? undefined : 'unknown-name'}>{c.name ?? 'Unknown caller'}</b>
                          <span className="tnum">{c.name ? c.phoneMasked : `${c.phoneMasked} · name not captured`}</span>
                        </span>
                      </span>
                      <span className="p-date tnum" role="cell">
                        {c.lastCallAt ? when(c.lastCallAt, now) : '—'}
                      </span>
                      <span className="p-issue" role="cell">
                        <IntentIcon intent={intentFromLabel(c.lastIntentLabel)} width={16} height={16} />
                        <span className="p-issue-main">
                          <b>{c.lastIntentLabel ? capitalize(c.lastIntentLabel) : '—'}</b>
                          {c.lastSummary && <span>{c.lastSummary}</span>}
                        </span>
                      </span>
                      <span className="num tnum" role="cell" data-l="Calls">
                        {c.callCount}
                      </span>
                      <span className="num tnum" role="cell" data-l="Amount">
                        {c.lastAmountUsd != null ? usd(c.lastAmountUsd) : '—'}
                      </span>
                      <span role="cell">
                        <span className={`st ${st.cls}`}>{st.label}</span>
                      </span>
                      <span role="cell" className="p-menu-cell">
                        <RowMenu
                          id={c.key}
                          open={menu === c.key}
                          setOpen={(o) => setMenu(o ? c.key : null)}
                          items={[
                            { label: 'View history', run: () => find(c.name ?? c.phoneMasked, 'history') },
                            ...(c.openStatus ? [{ label: 'Go to queue', run: () => navigate('/queue') }] : []),
                          ]}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : hList.length === 0 ? (
          <Empty text={needle ? `No callbacks match "${q}".` : 'Finished callbacks show up here.'} />
        ) : (
          <div className="prows prows-history" role="table" aria-label="Callback history">
            <div className="prow-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">Caller</span>
              <span role="columnheader">Completed</span>
              <span role="columnheader">Issue</span>
              <span role="columnheader" className="num">
                Amount
              </span>
              <span role="columnheader" className="num">
                Waited
              </span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="sr">
                Actions
              </span>
            </div>
            <ul>
              {hList.map((i, idx) => (
                <li key={i.id} className={`prow${menu === i.id ? ' is-open' : ''}`} role="row" style={{ animationDelay: `${Math.min(idx, 10) * 30}ms` }}>
                  <span className="p-idx tnum" role="cell">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="p-who" role="cell">
                    <span className={`p-av tier-${i.tier}`} aria-hidden="true">
                      {i.name ? initials(i.name) : '?'}
                    </span>
                    <span className="p-who-main">
                      <b className={i.name ? undefined : 'unknown-name'}>{i.name ?? 'Unknown caller'}</b>
                      <span className="tnum">{i.name ? i.phoneMasked : `${i.phoneMasked} · name not captured`}</span>
                    </span>
                  </span>
                  <span className="p-date tnum" role="cell">
                    {i.doneAt ? when(i.doneAt, now) : '—'}
                  </span>
                  <span className="p-issue" role="cell">
                    <IntentIcon intent={i.intent} width={16} height={16} />
                    <span className="p-issue-main">
                      <b>{capitalize(i.intentLabel)}</b>
                      <span>{i.summary}</span>
                    </span>
                  </span>
                  <span className="num tnum" role="cell" data-l="Amount">
                    {i.amountUsd != null ? usd(i.amountUsd) : '—'}
                  </span>
                  <span className="num tnum" role="cell" data-l="Waited">
                    {mins((i.claimedAt ?? i.doneAt ?? i.createdAt) - i.createdAt)}
                  </span>
                  <span role="cell">
                    <span className="st st-done">{busy === i.id ? 'Reopening…' : 'Completed'}</span>
                  </span>
                  <span role="cell" className="p-menu-cell">
                    <RowMenu
                      id={i.id}
                      open={menu === i.id}
                      setOpen={(o) => setMenu(o ? i.id : null)}
                      items={[
                        { label: 'Reopen', run: () => void reopen(i) },
                        { label: 'View caller', run: () => find(i.name ?? i.phoneMasked, 'callers') },
                      ]}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {callers.data && history.data && (
        <p className="muted small t-foot">Updated {ago(Date.now() - Math.max(callers.fetchedAt, history.fetchedAt))}</p>
      )}
      <Toast toast={toast} onHide={hide} />
    </div>
  );
}

/** Round kebab button with a small menu. Click outside or Esc closes; focus returns to the button. */
function RowMenu({ id, open, setOpen, items }: { id: string; open: boolean; setOpen: (o: boolean) => void; items: Array<{ label: string; run: () => void }> }) {
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector('button')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <span className="p-menu">
      <button
        ref={btn}
        type="button"
        className="kebab"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`menu-${id}`}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5.5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="18.5" r="1.8" />
        </svg>
      </button>
      {open && (
        <div ref={box} className="p-menu-list" role="menu" id={`menu-${id}`}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="t-empty">
      <span className="empty-mark small-mark" aria-hidden="true">
        <IntentIcon intent="other" width={22} height={22} />
      </span>
      <p className="muted">{text}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="t-skel prows" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="t-skel-row prow">
          <span className="sk" style={{ width: '5rem', height: '0.8rem' }} />
          <span className="sk" style={{ width: '2.2rem', height: '2.2rem', borderRadius: '50%' }} />
          <span className="sk" style={{ width: '9rem', height: '0.9rem' }} />
          <span className="sk" style={{ width: '12rem', height: '0.8rem' }} />
          <span className="sk" style={{ width: '4.5rem', height: '1.4rem', marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
}

