import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, api, errorText } from '../api';
import { useAuth } from '../auth';
import { TIERS, TIER_LABEL, ago } from '../format';
import { useDebounced, useNow, usePoll } from '../hooks';
import { PageHeader } from '../components/Shell';
import { IconInfo } from '../components/Icons';
import type { DialNumber, Intent, IntentRule, OrgSettings, OrgView, PublishResponse, Tier } from '../types';

const INTENT_ORDER: Intent[] = [
  'fraud_in_progress',
  'medical_emergency',
  'locked_out',
  'payment_issue',
  'money_movement',
  'account_change',
  'dispute',
  'account_opening',
  'general_question',
  'other',
];

export default function SetupPage() {
  const { me } = useAuth();
  if (!me) return null;
  return me.org ? <Editor org={me.org} /> : <CreateOrg />;
}

function CreateOrg() {
  const { refreshMe } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createOrg(name.trim());
      await refreshMe();
    } catch (err) {
      // Already a member (e.g. created in another tab): just reload who we are.
      if (err instanceof ApiError && err.code === 'already_member') await refreshMe();
      else setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-pad setup-create">
      <p className="step-num tnum">01</p>
      <h1 className="setup-title">What's your company called?</h1>
      <p className="muted lead">Callers hear it first.</p>
      <form className="form inline-lg" onSubmit={submit}>
        <input
          className="input-lg"
          required
          maxLength={80}
          placeholder="Company name"
          aria-label="Company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button className="btn btn-ink" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create my Rung'}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface Draft {
  name: string;
  settings: OrgSettings;
}

const toDraft = (org: OrgView): Draft => ({ name: org.name, settings: structuredClone(org.settings) });
const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function Editor({ org }: { org: OrgView }) {
  const { refreshMe, me } = useAuth();
  const requireVerification = me?.platform.requireVerification ?? false;
  const [draft, setDraft] = useState<Draft>(() => toDraft(org));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<PublishResponse | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Different org (e.g. re-login) → reset the draft.
  useEffect(() => setDraft(toDraft(org)), [org.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = useMemo(() => JSON.stringify(toDraft(org)), [org]);
  const dirty = JSON.stringify(draft) !== saved;

  const setS = <K extends keyof OrgSettings>(k: K, v: OrgSettings[K]) =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, [k]: v } }));
  const setIntent = (k: Intent, patch: Partial<IntentRule>) =>
    setDraft((d) => ({
      ...d,
      settings: { ...d.settings, intents: { ...d.settings.intents, [k]: { ...d.settings.intents[k], ...patch } } },
    }));

  async function save(): Promise<boolean> {
    setSaving(true);
    setSaveMsg(null);
    try {
      const settings = { ...draft.settings, valueTiers: [...draft.settings.valueTiers].sort((a, b) => a.minUsd - b.minUsd) };
      const res = await api.patchOrg({ name: draft.name.trim(), settings });
      setDraft(toDraft(res.org));
      await refreshMe();
      setSaveMsg({ ok: true, text: 'Saved.' });
      return true;
    } catch (err) {
      setSaveMsg({ ok: false, text: errorText(err) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    setPublished(null);
    try {
      if (dirty && !(await save())) {
        setPublishError('Fix the settings above before publishing.');
        return;
      }
      const res = await api.publish();
      setPublished(res);
      await refreshMe();
    } catch (err) {
      setPublishError(errorText(err));
    } finally {
      setPublishing(false);
    }
  }

  const s = draft.settings;
  const intentKeys = INTENT_ORDER.filter((k) => s.intents[k]);

  return (
    <div className="page-pad setup">
      <PageHeader
        title="Setup"
        sentence={`${org.dialNumber ? `Callers dial ${org.dialNumber}` : 'No number yet'} · ${org.publishedAt ? `published ${ago(Date.now() - org.publishedAt)}` : 'not published'}`}
        right={
        <div className="save-bar">
          {saveMsg && (
            <span key={saveMsg.text} className={`save-msg ${saveMsg.ok ? 'ok' : 'form-error'}`}>
              {saveMsg.text}
            </span>
          )}
          {dirty && !saveMsg && <span className="save-msg muted">Unsaved</span>}
          <button type="button" className="btn" disabled={!dirty || saving} onClick={() => setDraft(toDraft(org))}>
            Discard
          </button>
          <button type="button" className="btn btn-ink" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        }
      />

      <div className="setup-grid">
        <div className="setup-main">
          <Step n="01" i={0} title="Company">
            <label className="field">
              <span>Company name</span>
              <input value={draft.name} maxLength={80} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </label>
          </Step>

          <Step n="02" i={1} title="Voice">
            <label className="field">
              <span>Greeting, the first line callers hear</span>
              <input value={s.greeting} onChange={(e) => setS('greeting', e.target.value)} />
            </label>
            <label className="field">
              <span>Tone</span>
              <input value={s.tone} onChange={(e) => setS('tone', e.target.value)} placeholder="warm, brief, plain English" />
            </label>
          </Step>

          <Step
            n="03"
            i={2}
            title="Ranking rules"
            tip={`Score = urgency + value + waiting. ${
              requireVerification ? 'Verify = caller must pass the text code first.' : "Sensitive = the agent won't discuss details on the call."
            }`}
          >
            <div className="table-wrap">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th scope="col">Intent</th>
                    <th scope="col">Points</th>
                    <th scope="col">Tier</th>
                    {requireVerification ? (
                      <th scope="col" title="Sensitive: needs a verified caller">
                        Verify
                      </th>
                    ) : (
                      <th scope="col">
                        <span className="th-tip" data-tip="Agent won't discuss details on the call; a specialist handles it on the callback" tabIndex={0}>
                          Sensitive
                        </span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {intentKeys.map((k) => {
                    const r = s.intents[k];
                    return (
                      <tr key={k} className={`tier-${r.tier}`}>
                        <td>
                          <input
                            className="cell-input"
                            aria-label={`${k} label`}
                            value={r.label}
                            onChange={(e) => setIntent(k, { label: e.target.value })}
                          />
                          <code className="intent-key">{k}</code>
                        </td>
                        <td>
                          <input
                            className="cell-input num tnum"
                            type="number"
                            min={0}
                            aria-label={`${r.label} points`}
                            value={r.points}
                            onChange={(e) => setIntent(k, { points: num(e.target.value) })}
                          />
                        </td>
                        <td>
                          <span className="tier-pick">
                            <i className="tier-dot" aria-hidden="true" />
                            <select aria-label={`${r.label} tier`} value={r.tier} onChange={(e) => setIntent(k, { tier: e.target.value as Tier })}>
                              {TIERS.map((t) => (
                                <option key={t} value={t}>
                                  {TIER_LABEL[t]}
                                </option>
                              ))}
                            </select>
                          </span>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${r.label} sensitive`}
                            checked={r.sensitive}
                            onChange={(e) => setIntent(k, { sensitive: e.target.checked })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3 className="sub-h">Value tiers</h3>
            <ul className="value-tiers">
              {s.valueTiers.map((v, i) => (
                <li key={i}>
                  <label>
                    <span>From $</span>
                    <input
                      className="cell-input num tnum"
                      type="number"
                      min={0}
                      value={v.minUsd}
                      onChange={(e) => setS('valueTiers', s.valueTiers.map((x, j) => (j === i ? { ...x, minUsd: num(e.target.value) } : x)))}
                    />
                  </label>
                  <label>
                    <span>points</span>
                    <input
                      className="cell-input num tnum"
                      type="number"
                      min={0}
                      value={v.points}
                      onChange={(e) => setS('valueTiers', s.valueTiers.map((x, j) => (j === i ? { ...x, points: num(e.target.value) } : x)))}
                    />
                  </label>
                  <button type="button" className="link-btn" onClick={() => setS('valueTiers', s.valueTiers.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const last = s.valueTiers[s.valueTiers.length - 1];
                setS('valueTiers', [...s.valueTiers, { minUsd: last ? last.minUsd * 10 || 100 : 100, points: last ? last.points + 8 : 8 }]);
              }}
            >
              Add tier
            </button>

            <h3 className="sub-h">Aging and capacity</h3>
            <div className="num-grid">
              <NumField label="Aging points per minute" value={s.agingPerMin} onChange={(v) => setS('agingPerMin', v)} />
              <NumField label="Aging cap (points)" value={s.agingCap} onChange={(v) => setS('agingCap', v)} />
              <NumField label="Avg handle time (min)" value={s.avgHandleMin} onChange={(v) => setS('avgHandleMin', v)} />
              <NumField label="Reps on shift" value={s.repsOnShift} onChange={(v) => setS('repsOnShift', v)} />
              <NumField label="Hold time replaced (min)" value={s.baselineHoldMin} onChange={(v) => setS('baselineHoldMin', v)} />
              <NumField label="Re-explaining avoided (min)" value={s.reexplainMin} onChange={(v) => setS('reexplainMin', v)} />
            </div>
          </Step>

          <Step n="04" i={3} title="Phone number">
            <Numbers org={org} />
          </Step>

          <Step n="05" i={4} title="Publish to Dial" tip="Pushes the prompt preview to your number's voice agent.">
            <div className="inline">
              <button type="button" className="btn btn-primary" disabled={publishing || !org.dialNumberId} onClick={() => void publish()}>
                {publishing ? 'Publishing…' : dirty ? 'Save and publish' : 'Publish to Dial'}
              </button>
              {!org.dialNumberId && <span className="muted">Claim a number first.</span>}
            </div>
            {publishError && (
              <p className="form-error" role="alert">
                {publishError}
              </p>
            )}
            {published && (
              <div className="publish-result" role="status">
                <p className="publish-ok">
                  <svg className="check-draw" viewBox="0 0 28 28" aria-hidden="true">
                    <circle cx="14" cy="14" r="13" />
                    <path d="M8 14.5l4 4L20.5 10" />
                  </svg>
                  <span>
                    Live on <b className="tnum">{published.number}</b>
                    {published.mock && <span className="muted"> · mock, recorded not sent</span>}
                  </span>
                </p>
                {published.mock && (
                  <div className="request">
                    <p className="request-line tnum">
                      <b>{published.request.method}</b> {published.request.path}
                    </p>
                    <pre className="code-block">{JSON.stringify(published.request.body, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            <h3 className="sub-h" data-tip="Paste into the Dial agent's MCP settings. Treat it like a password.">
              Context MCP URL <IconInfo width={14} height={14} />
            </h3>
            <CopyField value={org.mcpUrl} />
          </Step>

          <DialLog />
        </div>

        <aside className="setup-side">
          <PromptPreview draft={draft} />
        </aside>
      </div>
    </div>
  );
}

function Step({ n, i, title, tip, children }: { n: string; i: number; title: string; tip?: string; children: ReactNode }) {
  return (
    <section className="step card" aria-labelledby={`step-${n}`} style={{ animationDelay: `${i * 50}ms` }}>
      <p className="step-num tnum" aria-hidden="true">
        {n}
      </p>
      <div className="step-body">
        <h2 id={`step-${n}`}>
          {title}
          {tip && (
            <span className="tip-icon" data-tip={tip} tabIndex={0} aria-label={tip}>
              <IconInfo width={16} height={16} />
            </span>
          )}
        </h2>
        {children}
      </div>
    </section>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="tnum" type="number" min={0} step="any" value={value} onChange={(e) => onChange(num(e.target.value))} />
    </label>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <code>{value}</code>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Numbers({ org }: { org: OrgView }) {
  const { refreshMe } = useAuth();
  const [numbers, setNumbers] = useState<DialNumber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.numbers();
      setNumbers(res.numbers);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }
  useEffect(() => {
    void load();
  }, [org.dialNumberId]);

  async function claim(id: string) {
    setBusy(id);
    setError(null);
    try {
      await api.claimNumber(id);
      await refreshMe();
    } catch (err) {
      setError(errorText(err));
      void load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <p className="muted">
        {org.dialNumber ? (
          <>
            Callers dial <strong className="tnum">{org.dialNumber}</strong>
            {org.dialNumberMock ? ' (mock number)' : ''}
          </>
        ) : (
          'Pick a number'
        )}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!numbers ? (
        !error && <p className="muted">Loading numbers…</p>
      ) : numbers.length === 0 ? (
        <p className="muted">No numbers in the pool.</p>
      ) : (
        <ul className="numbers">
          {numbers.map((n) => (
            <li key={n.id} className={n.mine ? 'mine' : !n.available ? 'taken' : ''}>
              <span className="num-val tnum">{n.number}</span>
              {n.mock && <span className="tag">mock number</span>}
              <span className="num-act">
                {n.mine ? (
                  <span className="ok">Yours</span>
                ) : !n.available ? (
                  <button type="button" className="btn" disabled>
                    Taken
                  </button>
                ) : (
                  <button type="button" className="btn" disabled={busy !== null} onClick={() => void claim(n.id)}>
                    {busy === n.id ? 'Claiming…' : 'Claim'}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PromptPreview({ draft }: { draft: Draft }) {
  const debounced = useDebounced(draft, 500);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .promptPreview({ name: debounced.name, settings: debounced.settings })
      .then((r) => {
        if (!alive) return;
        setPrompt(r.prompt);
        setError(null);
      })
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced]);

  return (
    <section className="prompt-preview card" aria-labelledby="pp-h">
      <div className="pp-head">
        <h2 id="pp-h">Prompt preview</h2>
        <span className={`pp-status${loading ? ' is-loading' : ''}`}>{loading ? 'Updating' : 'Live'}</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <pre className={`code-block pp-body${loading && prompt ? ' is-stale' : ''}`}>{prompt ?? (error ? '' : 'Rendering…')}</pre>
    </section>
  );
}

function DialLog() {
  const log = usePoll(api.dialLog, 4000, true, (e) => e instanceof ApiError && e.status === 404);
  const now = useNow(5000);
  const d = log.data;
  if (!d) return null;
  const rows = [
    ...d.patches.map((p) => ({ at: p.at, kind: 'PATCH', text: `/numbers/${p.numberId} · ${p.inboundInstruction.length.toLocaleString('en-US')} chars` })),
    ...d.sms.map((s) => ({ at: s.at, kind: 'SMS', text: `${s.from ?? '(no number)'} → ${s.toMasked} · ${s.body}` })),
    ...d.callFetches.map((c) => ({ at: c.at, kind: 'GET', text: `/calls/${c.callId}` })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);
  return (
    <section className="step card" aria-labelledby="dial-log-h" style={{ animationDelay: '250ms' }}>
      <p className="step-num tnum" aria-hidden="true">
        ··
      </p>
      <div className="step-body">
        <h2 id="dial-log-h">Dial activity{d.mock ? ' (mock)' : ''}</h2>
        {rows.length === 0 ? (
          <p className="muted">Nothing sent to Dial yet.</p>
        ) : (
          <ul className="dial-log">
            {rows.map((r, i) => (
              <li key={i}>
                <b className="tnum">{r.kind}</b>
                <span>{r.text}</span>
                <span className="muted tnum">{ago(now - r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
