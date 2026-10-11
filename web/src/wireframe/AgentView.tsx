import { useState, type ReactNode } from 'react';
import llms from '../../public/llms.txt?raw';

/*
 * "For agents" view of the site. Same content as /llms.txt (the llms.txt convention: one markdown file that tells
 * AI agents what a site is), rendered as plain semantic HTML so an agent reading the DOM or the raw file gets the same facts.
 */

/** Inline `code` only; everything else is plain text. */
function inline(t: string): ReactNode[] {
  return t.split(/(`[^`]+`)/g).map((part, i) => (part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

/** Tiny renderer for the subset of markdown llms.txt uses: #, ##, >, -, nested -, 1., paragraphs. */
function render(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('# ')) out.push(<h1 key={i}>{l.slice(2)}</h1>);
    else if (l.startsWith('## ')) out.push(<h2 key={i}>{l.slice(3)}</h2>);
    else if (l.startsWith('> ')) out.push(<p key={i} className="wf-ag-lede">{inline(l.slice(2))}</p>);
    else if (/^(- |\d+\. )/.test(l)) {
      const ordered = /^\d+\. /.test(l);
      const items: ReactNode[] = [];
      while (i < lines.length && /^(- |\d+\. |  - )/.test(lines[i])) {
        const top = lines[i].replace(/^(- |\d+\. )/, '');
        const sub: string[] = [];
        while (i + 1 < lines.length && lines[i + 1].startsWith('  - ')) sub.push(lines[++i].slice(4));
        items.push(
          <li key={i}>
            {inline(top)}
            {sub.length > 0 && <ul>{sub.map((x, k) => <li key={k}>{inline(x)}</li>)}</ul>}
          </li>,
        );
        i++;
      }
      out.push(ordered ? <ol key={`l${i}`}>{items}</ol> : <ul key={`l${i}`}>{items}</ul>);
      continue;
    } else if (l.trim()) out.push(<p key={i}>{inline(l)}</p>);
    i++;
  }
  return out;
}

export default function AgentView() {
  const [copied, setCopied] = useState(false);
  return (
    <main className="wf-agents">
      <div className="wf-ag-bar">
        <span>Markdown · also at <a href="/llms.txt">/llms.txt</a></span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(llms).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy as Markdown'}
        </button>
      </div>
      <article className="wf-ag-doc">{render(llms)}</article>
    </main>
  );
}
