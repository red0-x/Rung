interface Props {
  urgency: number;
  value: number;
  /** Fractional so the hatched segment creeps instead of jumping once a minute. */
  aging: number;
  scaleMax: number;
}

/** One bar per caller: solid = urgency, blue = value, hatched = time spent waiting. */
export function ScoreBar({ urgency, value, aging, scaleMax }: Props) {
  const w = (n: number) => `${Math.min(100, (n / scaleMax) * 100)}%`;
  return (
    <div className="bar" aria-hidden="true">
      <i className="seg seg-urgency" style={{ width: w(urgency) }} />
      <i className="seg seg-value" style={{ width: w(value) }} />
      <i className="seg seg-aging" style={{ width: w(aging) }} />
    </div>
  );
}
