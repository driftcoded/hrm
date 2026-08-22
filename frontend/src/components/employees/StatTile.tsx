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
   * Dòng chú thích dưới con số. Bỏ trống thì thẻ không hiện dòng nào.
   *
   * KHÔNG phải kiểu "+12 so với tháng trước": bảng `employees` chỉ lưu trạng
   * thái hiện tại, không có bảng lịch sử, nên không suy ra được số liệu
   * tháng-trên-tháng một cách trung thực.
   */
  caption?: string;
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
        {caption ? <p className={styles.caption}>{caption}</p> : null}
      </div>
    </div>
  );
}
