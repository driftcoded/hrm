import type { ReactNode } from 'react';
import { Tooltip } from 'antd';
import { ArrowUpOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './KpiCard.module.css';

export type KpiTone = 'blue' | 'green' | 'cyan' | 'purple';

interface KpiCardProps {
  icon: ReactNode;
  tone: KpiTone;
  label: string;
  /** Already formatted for display (currency, thousands separators, …). */
  value: string;
  /** Pre-formatted delta line; `null` renders the "unchanged" wording. */
  delta: string | null;
  /** Longer explanation behind the little info icon. */
  hint: string;
}

/**
 * One KPI tile: tinted icon square + label + big value + change-vs-last-month.
 *
 * The delta is not color-alone — it ships with an arrow icon and wording, so the
 * direction survives a colorblind reader and a grayscale print (§11).
 */
export function KpiCard({ icon, tone, label, value, delta, hint }: KpiCardProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <span className={`${styles.tile} ${styles[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.body}>
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          <Tooltip title={hint}>
            {/* Focusable so the hint is reachable without a mouse (§11). */}
            <button type="button" className={styles.hintButton} aria-label={hint}>
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </div>
        <p className={styles.value}>{value}</p>
        {delta === null ? (
          <p className={styles.deltaFlat}>{t('dashboard.kpi.unchanged')}</p>
        ) : (
          <p className={styles.deltaUp}>
            <ArrowUpOutlined aria-hidden="true" /> {delta}
          </p>
        )}
      </div>
    </div>
  );
}
