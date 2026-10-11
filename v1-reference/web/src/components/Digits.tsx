/** Fixed-width digits so a ticking clock does not jitter, whatever the font's numerals do. */
export function Digits({ text }: { text: string }) {
  return (
    <span className="digits">
      <span className="sr">{text}</span>
      <span aria-hidden="true">
        {[...text].map((c, i) => (
          <span key={i} className={c === ':' ? 'colon' : 'digit'}>
            {c}
          </span>
        ))}
      </span>
    </span>
  );
}
