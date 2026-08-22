import { Avatar, Card, Empty, Skeleton, Statistic, Tabs, Tag, Typography } from 'antd';
import { InfoCircleOutlined, RightOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/format';
import styles from './ExpiringCard.module.css';

const { Text } = Typography;

export interface ExpiringRow {
  id: number;
  fullName: string;
  /** Stored: leave type name for pending leave, or position name. */
  position: string | null;
  department: string | null;
  dueDate: string;
  daysLeft: number;
}

interface TabConfig {
  key: string;
  labelKey: string;
  rows?: ExpiringRow[];
  countOnly?: number;
  windowDays?: number;
  loading?: boolean;
}

interface ExpiringCardProps {
  tabs: TabConfig[];
}

function RowList({ rows, loading }: { rows: ExpiringRow[]; loading?: boolean }) {
  const { t } = useTranslation();

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />;
  if (rows.length === 0) return <Empty description={t('common.noData')} />;

  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.id} className={styles.item}>
          <Avatar size={36} icon={<UserOutlined />} className={styles.avatar} />
          <div className={styles.meta}>
            <Text strong className={styles.name}>{row.fullName}</Text>
            {row.department && (
              <Text type="secondary" className={styles.dept}>{row.department}</Text>
            )}
          </div>
          {row.position && (
            <Tag color="blue" className={styles.badge}>{row.position}</Tag>
          )}
          <div className={styles.dateWrap}>
            {row.daysLeft <= 7 ? (
              <Text className={styles.urgent}>
                {t('dashboard.expiring.days', { count: row.daysLeft })}
              </Text>
            ) : (
              <Text type="secondary">{formatDate(row.dueDate)}</Text>
            )}
          </div>
          <RightOutlined className={styles.chevron} />
        </li>
      ))}
    </ul>
  );
}

export function ExpiringCard({ tabs }: ExpiringCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      variant="borderless"
      className={styles.card}
      title={
        <span className={styles.cardTitle}>
          {t('dashboard.expiring.title')}
          <button
            type="button"
            className={styles.hintButton}
            title={t('dashboard.expiring.hint')}
            aria-label={t('dashboard.expiring.hint')}
          >
            <InfoCircleOutlined />
          </button>
        </span>
      }
    >
      <Tabs
        items={tabs.map(({ key, labelKey, rows, countOnly, windowDays, loading }) => ({
          key,
          label: t(labelKey),
          children:
            countOnly !== undefined ? (
              <div className={styles.countOnly}>
                {loading ? (
                  <Skeleton.Input active />
                ) : (
                  <Statistic value={countOnly} suffix={t('dashboard.expiring.employees')} />
                )}
                {windowDays !== undefined && (
                  <Text type="secondary">
                    {t('dashboard.expiring.inWindow', { count: windowDays })}
                  </Text>
                )}
                <Link to="/employees">{t('dashboard.expiring.viewEmployees')}</Link>
              </div>
            ) : (
              <RowList rows={rows ?? []} loading={loading} />
            ),
        }))}
      />
      <div className={styles.footer}>
        <Link to="/leave-requests">{t('dashboard.viewAll')} →</Link>
      </div>
    </Card>
  );
}
