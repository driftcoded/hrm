import type { ReactNode } from 'react';
import { Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import styles from './StatCard.module.css';

export type StatCardTone = 'blue' | 'teal' | 'purple' | 'green' | 'amber';

export interface StatCardProps {
  icon: ReactNode;
  tone: StatCardTone;
  /** Short uppercase label, e.g. "Tổng phòng ban". */
  label: string;
  /** Already formatted for display (thousands separators, percent, …). */
  value: string;
  /**
   * One line of context under the value, saying what the number actually
   * counts — or `null` when there is nothing true to say.
   *
   * Deliberately NOT a "+2 so với tháng trước" delta: nothing in this schema
   * keeps historical snapshots, so a month-over-month figure cannot be derived
   * honestly. A tile that has no caption shows no caption rather than an
   * invented trend.
   */
  caption?: string | null;
  /** The `ⓘ` tooltip: precisely what this number counts. */
  hint: string;
}

/**
 * One KPI tile: tinted icon square, label with an `ⓘ` hint, big value, caption.
 *
 * Lives in `common/` because it is the neutral shape three screens want. It is
 * NOT `dashboard/KpiCard` — that component is built around a change-vs-last-month
 * line with an arrow, which is exactly the claim a tile with no history table
 * behind it must not make.
 *
 * §11: the `ⓘ` is a real focusable `<button>` carrying the hint as its accessible
 * name, so the explanation is reachable without a mouse.
 */
export function StatCard({ icon, tone, label, value, caption, hint }: StatCardProps) {
  return (
    <div className={styles.card}>
      <span className={`${styles.tile} ${styles[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.body}>
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          <Tooltip title={hint}>
            <button type="button" className={styles.hintButton} aria-label={hint}>
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </div>
        <p className={styles.value}>{value}</p>
        {caption ? <p className={styles.caption}>{caption}</p> : null}
      </div>
    </div>
  );
}
