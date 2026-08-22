import { Avatar, Card, Empty, Skeleton, Statistic, Table, Tabs, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InfoCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/format';
import styles from './ExpiringCard.module.css';

const { Text } = Typography;

export interface ExpiringRow {
  id: number;
  fullName: string;
  position: string | null;
  department: string | null;
  dueDate: string;
  daysLeft: number;
}

type Urgency = 'critical' | 'warning' | 'ok';

function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft <= 3) return 'critical';
  if (daysLeft <= 7) return 'warning';
  return 'ok';
}

interface TabConfig {
  key: string;
  labelKey: string;
  rows?: ExpiringRow[];
  /** Show a count statistic instead of a table (used when list is not available). */
  countOnly?: number;
  windowDays?: number;
  loading?: boolean;
  dueDateLabelKey?: string;
}

interface ExpiringCardProps {
  tabs: TabConfig[];
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
          <Tooltip title={t('dashboard.expiring.hint')}>
            <button
              type="button"
              className={styles.hintButton}
              aria-label={t('dashboard.expiring.hint')}
            >
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </span>
      }
    >
      <Tabs
        items={tabs.map(({ key, labelKey, rows, countOnly, windowDays, loading, dueDateLabelKey }) => {
          const columns: ColumnsType<ExpiringRow> = [
            {
              title: t('dashboard.expiring.employee'),
              dataIndex: 'fullName',
              key: 'fullName',
              render: (fullName: string) => (
                <span className={styles.person}>
                  <Avatar size={28} icon={<UserOutlined />} alt="" />
                  <span className={styles.personName}>{fullName}</span>
                </span>
              ),
            },
            { title: t('dashboard.expiring.position'), dataIndex: 'position', key: 'position' },
            { title: t('dashboard.expiring.department'), dataIndex: 'department', key: 'department' },
            {
              title: t(dueDateLabelKey ?? 'dashboard.expiring.dueDate'),
              dataIndex: 'dueDate',
              key: 'dueDate',
              render: (value: string) => formatDate(value),
            },
            {
              title: t('dashboard.expiring.daysLeft'),
              dataIndex: 'daysLeft',
              key: 'daysLeft',
              align: 'right',
              render: (daysLeft: number) => (
                <Text className={styles[urgencyOf(daysLeft)]}>
                  {t('dashboard.expiring.days', { count: daysLeft })}
                </Text>
              ),
            },
          ];

          const countOnlyContent =
            countOnly !== undefined ? (
              <div className={styles.countOnly}>
                {loading ? (
                  <Skeleton.Input active style={{ width: 80 }} />
                ) : (
                  <Statistic
                    value={countOnly}
                    suffix={t('dashboard.expiring.employees')}
                  />
                )}
                {windowDays !== undefined && (
                  <Text type="secondary">
                    {t('dashboard.expiring.inWindow', { count: windowDays })}
                  </Text>
                )}
                <Link to="/employees">{t('dashboard.expiring.viewEmployees')}</Link>
              </div>
            ) : null;

          return {
            key,
            label: t(labelKey),
            children:
              countOnlyContent ?? (
                <Table<ExpiringRow>
                  columns={columns}
                  dataSource={rows ?? []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  loading={loading}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: <Empty description={t('common.noData')} /> }}
                />
              ),
          };
        })}
      />
      <div className={styles.footer}>
        <Link to="/employees">{t('dashboard.viewAll')} →</Link>
      </div>
    </Card>
  );
}
