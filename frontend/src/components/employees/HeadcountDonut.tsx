import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DepartmentHeadcount } from '@/types/employee.types';
import styles from './HeadcountDonut.module.css';

/**
 * Headcount by department, as a donut with a legend.
 *
 * Hand-drawn SVG rather than a chart library: the project has no charting
 * dependency, and one static donut does not justify adding ~100KB to the bundle
 * for a feature that is six arcs and a legend. It is drawn with `stroke-dasharray`
 * on concentric circles, so there is no path maths to get wrong and the whole
 * thing scales with the container.
 *
 * Accessibility (§11): the SVG is `aria-hidden` and the legend beside it carries
 * every number in text, so the chart adds nothing a screen reader would miss.
 * Color is never the only channel — each legend row names its department.
 */

/**
 * Slice colors, in order. Chosen to stay distinguishable in grayscale by
 * alternating light and dark, and drawn from the token palette's hue families
 * rather than invented per-chart.
 */
const SLICE_COLORS = [
  '#1677ff',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#13a8a8',
  '#eb2f96',
  '#fa8c16',
  '#2f54eb',
];

/** Anything past this many departments is folded into one "Khác" slice. */
const MAX_SLICES = 7;

const RADIUS = 60;
const STROKE = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Slice {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
  /** Length of the coloured arc, in the same units as `CIRCUMFERENCE`. */
  dash: number;
  /** How far around the circle this slice starts. */
  offset: number;
}

export interface HeadcountDonutProps {
  data: DepartmentHeadcount[];
  total: number;
}

export function HeadcountDonut({ data, total }: HeadcountDonutProps) {
  const { t } = useTranslation();

  const slices = useMemo<Slice[]>(() => {
    if (total <= 0 || data.length === 0) {
      return [];
    }

    // The server already sorts by headcount descending; the tail becomes "Khác"
    // so a company with 30 departments still gets a readable legend.
    const head = data.slice(0, MAX_SLICES);
    const tailCount = data.slice(MAX_SLICES).reduce((sum, row) => sum + row.count, 0);

    const entries = head.map((row) => ({
      key: String(row.departmentId),
      label: row.departmentName,
      count: row.count,
    }));

    if (tailCount > 0) {
      entries.push({ key: 'other', label: t('employees.overview.otherDepartments'), count: tailCount });
    }

    let cursor = 0;
    return entries.map((entry, index) => {
      const percent = (entry.count / total) * 100;
      const dash = (entry.count / total) * CIRCUMFERENCE;
      const slice: Slice = {
        ...entry,
        percent,
        color: SLICE_COLORS[index % SLICE_COLORS.length],
        dash,
        offset: cursor,
      };
      cursor += dash;
      return slice;
    });
  }, [data, t, total]);

  if (slices.length === 0) {
    return <p className={styles.empty}>{t('common.noData')}</p>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.chart}>
        <svg viewBox="0 0 160 160" className={styles.svg} aria-hidden="true" focusable="false">
          {/* Track behind the slices, so a rounding gap reads as part of the ring. */}
          <circle
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            stroke="var(--hrm-color-border-subtle)"
            strokeWidth={STROKE}
          />
          {slices.map((slice) => (
            <circle
              key={slice.key}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeDasharray={`${slice.dash} ${CIRCUMFERENCE - slice.dash}`}
              strokeDashoffset={-slice.offset}
              // Start at 12 o'clock instead of 3 o'clock, which is where a
              // reader expects a donut to begin.
              transform="rotate(-90 80 80)"
            />
          ))}
        </svg>
        <div className={styles.center}>
          <span className={styles.centerValue}>{total}</span>
          <span className={styles.centerLabel}>{t('employees.overview.totalLabel')}</span>
        </div>
      </div>

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.key} className={styles.legendRow}>
            <span className={styles.swatch} style={{ background: slice.color }} aria-hidden="true" />
            <span className={styles.legendLabel} title={slice.label}>
              {slice.label}
            </span>
            <span className={styles.legendValue}>
              {slice.count} ({Math.round(slice.percent)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
