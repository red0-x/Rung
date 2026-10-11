interface Props {
  urgency: number;
  value: number;
  /** Fractional so the hatched segment creeps instead of jumping once a minute. */
  aging: number;
  scaleMax: number;
  label?: string;
}

/** A fully rounded pill: tier color = urgency, cobalt = value, hatched = time waited. Grows in on mount. */
export function ScoreBar({ urgency, value, aging, scaleMax, label }: Props) {
  const w = (n: number) => `${Math.max(0, Math.min(100, (n / scaleMax) * 100))}%`;
  return (
    <div className="bar" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <div className="bar-fill">
        {urgency > 0 && <i className="seg seg-urgency" style={{ width: w(urgency) }} />}
        {value > 0 && <i className="seg seg-value" style={{ width: w(value) }} />}
        {aging > 0 && <i className="seg seg-aging" style={{ width: w(aging) }} />}
      </div>
    </div>
  );
}
