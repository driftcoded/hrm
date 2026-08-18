import { Card, Tooltip } from 'antd';
import {
  DollarCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  UserAddOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import { useTranslation } from 'react-i18next';
import type { ActivityItem, ActivityKind } from '@/pages/dashboard/mockData';
import styles from './ActivityCard.module.css';

// `calendar` renders "today / yesterday" wording; anything older falls back to a
// plain date. dayjs is already configured with the `vi` locale in main.tsx.
dayjs.extend(calendar);

const KIND_ICON: Record<ActivityKind, ReactNode> = {
  employee: <UserAddOutlined />,
  leave: <FileTextOutlined />,
  payroll: <DollarCircleOutlined />,
  contract: <WarningOutlined />,
};

interface ActivityCardProps {
  items: ActivityItem[];
}

export function ActivityCard({ items }: ActivityCardProps) {
  const { t } = useTranslation();

  /**
   * Relative-but-precise timestamp, driven by dayjs (never `new Date()`, per
   * frontend/CLAUDE.md). 24-hour time keeps it consistent with the documented
   * `DD/MM/YYYY HH:mm` convention instead of the reference's SA/CH form.
   */
  const formatWhen = (iso: string): string =>
    dayjs(iso).calendar(undefined, {
      sameDay: 'HH:mm',
      lastDay: `[${t('dashboard.activity.yesterday')}], HH:mm`,
      lastWeek: 'DD/MM/YYYY HH:mm',
      sameElse: 'DD/MM/YYYY HH:mm',
    });

  return (
    <Card
      variant="borderless"
      className={styles.card}
      title={
        <span className={styles.cardTitle}>
          {t('dashboard.activity.title')}
          <Tooltip title={t('dashboard.activity.hint')}>
            <button
              type="button"
              className={styles.hintButton}
              aria-label={t('dashboard.activity.hint')}
            >
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </span>
      }
    >
      <ul className={styles.feed}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <span className={`${styles.tile} ${styles[item.kind]}`} aria-hidden="true">
              {KIND_ICON[item.kind]}
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{t(item.titleKey, item.titleParams)}</span>
              <span className={styles.detail}>{t(item.detailKey, item.detailParams)}</span>
            </span>
            {/* `dateTime` gives assistive tech the exact instant behind the
                relative wording. */}
            <time className={styles.when} dateTime={item.at}>
              {formatWhen(item.at)}
            </time>
          </li>
        ))}
      </ul>
    </Card>
  );
}
