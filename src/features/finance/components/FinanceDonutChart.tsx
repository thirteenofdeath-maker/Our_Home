export interface DonutSegment {
  id: string;
  /**
   * 0..1 share of the whole, already computed by the caller from
   * authoritative decimal-string amounts (e.g. `Number(amount) /
   * Number(total)`) — display-only geometry, never itself rendered as a
   * money figure. The actual amount shown to the user always comes from
   * `formatCurrency` on the original decimal string.
   */
  ratio: number;
  /** A `stroke-*` (or any `color`-affecting) Tailwind class. */
  colorClassName: string;
}

/**
 * Small dependency-free SVG donut/ring chart. Pure presentation: given
 * pre-computed ratios that sum to at most 1, draws one arc per segment.
 * A single segment with ratio 1 renders as a full ring, which is the
 * legitimate "only one category" case.
 */
export function FinanceDonutChart({
  segments,
  size = 140,
  strokeWidth = 18,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Cumulative offsets computed up front via a pure reduce (no mutation
  // of an outer variable during render) — each segment's starting
  // offset is the running total of every arc length before it.
  const arcs = segments.reduce<Array<DonutSegment & { length: number; offset: number }>>((acc, segment) => {
    const length = Math.max(segment.ratio, 0) * circumference;
    const previousEnd = acc.length > 0 ? acc[acc.length - 1]!.offset + acc[acc.length - 1]!.length : 0;
    return [...acc, { ...segment, length, offset: previousEnd }];
  }, []);

  // Rotated via the SVG-native `transform` attribute (user-space, an
  // explicit center point in viewBox units) rather than a CSS
  // `transform`/`-rotate-90` class. A CSS transform's `transform-origin`
  // reference box for SVG elements is genuinely ambiguous across engines
  // (older WebKit/iOS Safari has resolved percentage origins against the
  // SVG viewport's (0,0) corner instead of the element's own center) —
  // that mismatch rotates the ring's center away from (size/2, size/2)
  // and off the visible canvas, which reads as "the donut is blank" even
  // though every arc is drawn correctly. The SVG attribute form has one
  // unambiguous meaning in every SVG-capable browser.
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} transform={`rotate(-90 ${size / 2} ${size / 2})`} role="presentation" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-finance-background" />
      {arcs.map((arc) => (
        <circle
          key={arc.id}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.length} ${circumference - arc.length}`}
          strokeDashoffset={-arc.offset}
          className={arc.colorClassName}
        />
      ))}
    </svg>
  );
}
