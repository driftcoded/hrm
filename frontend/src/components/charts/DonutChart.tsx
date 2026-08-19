import { useMemo, useState } from 'react';
import type { DonutSlice } from './donutSlices';
import styles from './DonutChart.module.css';

/**
 * Part-to-whole donut with a text legend.
 *
 * WHY HAND-DRAWN SVG AND NOT A CHART LIBRARY. The project has no charting
 * dependency. Recharts 3.10 does support React 19, but it ships a 7.4MB package
 * (~90–110KB gzipped in a route chunk) and would be pulled in for one static ring
 * — six arcs and a list — on a screen that otherwise weighs 13KB gzipped. Drawn
 * with `stroke-dasharray` on concentric circles there is no path arithmetic to get
 * wrong, the ring scales with its container, and the whole component costs about
 * 1KB. Reach for a library when a real chart appears (axes, zoom, time series);
 * not for this.
 *
 * ACCESSIBILITY (docs/ui-conventions.md §11, dataviz skill step 6). Colour is
 * never the only channel: the legend beside the ring names every slice and prints
 * its count and percentage as text, so the chart adds no information a screen
 * reader would miss. The `<svg>` is `aria-hidden` and each arc still carries an
 * SVG `<title>`, which browsers surface as a native tooltip on hover.
 *
 * COLOUR. Slot classes map to `--hrm-chart-1…7` from styles/tokens.css — a fixed
 * order validated for colour-vision separation against the white card surface (see
 * the comment on those tokens). `donutSlices.ts` assigns the slots and folds the
 * tail past seven into one grey "other" slice.
 *
 * INTERACTION. Hovering an arc or a legend row swaps the centre text to that
 * slice, which is the donut's tooltip — no floating layer to position, and the
 * same numbers are already in the legend as text, so nothing here is mouse-only.
 */

const SLOT_CLASS: Record<string, string> = {
  '1': styles.slot1,
  '2': styles.slot2,
  '3': styles.slot3,
  '4': styles.slot4,
  '5': styles.slot5,
  '6': styles.slot6,
  '7': styles.slot7,
  other: styles.slotOther,
};

export interface DonutChartProps {
  slices: DonutSlice[];
  /** Denominator for the percentages and the centre figure. */
  total: number;
  /** Small line above the centre figure, e.g. "Tổng". */
  centerLabel: string;
  /** Small line below the centre figure — the unit, e.g. "nhân sự". */
  centerCaption: string;
  /** Names the figure for assistive tech, e.g. "Phân bổ nhân sự theo phòng ban". */
  figureLabel: string;
  /** `(value, percent) => "6 (50%)"` — the caller owns VN number formatting. */
  formatSliceValue: (value: number, percent: number) => string;
  /** Shown instead of the ring when there is nothing to divide up. */
  emptyText: string;
}

const RADIUS = 60;
const STROKE = 20;
/** Surface gap between adjacent arcs, in user units (dataviz: 2px spacer). */
const GAP = 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Arc extends DonutSlice {
  percent: number;
  /** Painted length of the arc. */
  dash: number;
  /** Distance around the ring at which this arc starts. */
  offset: number;
}

export function DonutChart({
  slices,
  total,
  centerLabel,
  centerCaption,
  figureLabel,
  formatSliceValue,
  emptyText,
}: DonutChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const arcs = useMemo<Arc[]>(() => {
    if (total <= 0) {
      return [];
    }
    // A zero-value slice would be an invisible arc with a legend row claiming a
    // share of nothing, so it is dropped here; the table still lists it.
    const drawable = slices.filter((slice) => slice.value > 0);
    let cursor = 0;
    return drawable.map((slice) => {
      const length = (slice.value / total) * CIRCUMFERENCE;
      const arc: Arc = {
        ...slice,
        percent: (slice.value / total) * 100,
        dash: drawable.length > 1 ? Math.max(length - GAP, 0.5) : length,
        offset: cursor,
      };
      cursor += length;
      return arc;
    });
  }, [slices, total]);

  if (arcs.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  const active = arcs.find((arc) => arc.key === hovered);

  return (
    <div className={styles.wrapper}>
      <figure className={styles.figure} aria-label={figureLabel}>
        <div className={styles.chart} onMouseLeave={() => setHovered(null)}>
          <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true" focusable="false">
            <circle
              className={styles.track}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                className={[
                  styles.arc,
                  SLOT_CLASS[String(arc.slot)],
                  arc.key === hovered ? styles.arcActive : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
                cx="80"
                cy="80"
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                strokeDashoffset={-arc.offset}
                // Start at 12 o'clock, where a reader expects a ring to begin.
                transform="rotate(-90 80 80)"
                onMouseEnter={() => setHovered(arc.key)}
              >
                <title>{`${arc.label}: ${formatSliceValue(arc.value, arc.percent)}`}</title>
              </circle>
            ))}
          </svg>
          {/* The hole doubles as the tooltip: the hovered slice, or the total. */}
          <div className={styles.center}>
            <span className={styles.centerLabel}>{active ? active.label : centerLabel}</span>
            <span className={styles.centerValue}>{active ? active.value : total}</span>
            <span className={styles.centerCaption}>{centerCaption}</span>
          </div>
        </div>

        <ul className={styles.legend}>
          {arcs.map((arc) => (
            <li
              key={arc.key}
              className={styles.legendRow}
              onMouseEnter={() => setHovered(arc.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className={`${styles.swatch} ${SLOT_CLASS[String(arc.slot)]}`}
                aria-hidden="true"
              />
              <span className={styles.legendLabel} title={arc.label}>
                {arc.label}
              </span>
              <span className={styles.legendValue}>
                {formatSliceValue(arc.value, arc.percent)}
              </span>
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}
