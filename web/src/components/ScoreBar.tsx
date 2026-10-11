interface Props {
  urgency: number;
  value: number;
  /** Fractional so the hatched segment creeps instead of jumping once a minute. */
  aging: number;
  scaleMax: number;
}

/** One pill per caller: tier color = urgency, cobalt = value, hatched = time spent waiting. */
export function ScoreBar({ urgency, value, aging, scaleMax }: Props) {
  const w = (n: number) => `${Math.max(0, Math.min(100, (n / scaleMax) * 100))}%`;
  return (
    <div className="bar" aria-hidden="true">
      {urgency > 0 && <i className="seg seg-urgency" style={{ width: w(urgency) }} />}
      {value > 0 && <i className="seg seg-value" style={{ width: w(value) }} />}
      {aging > 0 && <i className="seg seg-aging" style={{ width: w(aging) }} />}
    </div>
  );
}
