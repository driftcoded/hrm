import type { ReactNode } from 'react';
import styles from './StatTile.module.css';

export type StatTone = 'blue' | 'orange' | 'teal' | 'purple';

export interface StatTileProps {
  icon: ReactNode;
  tone: StatTone;
  label: string;
  /** Already formatted for display (thousands separators, …). */
  value: string;
  /**
   * One line of context under the value — what the number actually counts
   * ("trong 30 ngày tới", "tuyển mới 30 ngày qua").
   *
   * NOT a "+12 vs last month" delta, and deliberately so: `employees` stores
   * current state only, with no history table behind it, so a month-over-month
   * figure for "đang thử việc" or "đang nghỉ phép" cannot be derived honestly.
   * Rather than print a number the data cannot support, each tile says what its
   * own figure means. See `EmployeeStats` in types/employee.types.ts.
   */
  caption: string;
}

/**
 * One overview tile: tinted icon square, label, big number, caption.
 *
 * A near-twin of the dashboard's `KpiCard` but not the same component: that one
 * is built around a change-vs-last-month line with an arrow, which is exactly
 * the thing this screen must not claim. Reusing it would have meant adding a
 * "no delta" mode to a component whose whole shape is the delta.
 */
export function StatTile({ icon, tone, label, value, caption }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={`${styles.icon} ${styles[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
        <p className={styles.caption}>{caption}</p>
      </div>
    </div>
  );
}
