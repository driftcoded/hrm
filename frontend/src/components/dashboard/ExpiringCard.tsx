import { Avatar, Card, Empty, Table, Tabs, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { InfoCircleOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/format';
import type { ExpiringRow } from '@/pages/dashboard/mockData';
import styles from './ExpiringCard.module.css';

const { Text } = Typography;

type Urgency = 'critical' | 'warning' | 'ok';

/**
 * Urgency thresholds live here, in one place, instead of being inlined in JSX —
 * they are business rules ("3 days out is critical") and will need to move to
 * config once HR can tune them.
 */
function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft <= 3) {
    return 'critical';
  }
  if (daysLeft <= 7) {
    return 'warning';
  }
  return 'ok';
}

interface ExpiringCardProps {
  tabs: Array<{ key: string; labelKey: string; rows: ExpiringRow[] }>;
}

export function ExpiringCard({ tabs }: ExpiringCardProps) {
  const { t } = useTranslation();

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
      title: t('dashboard.expiring.dueDate'),
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
        // Not color-alone: the number and its unit are always spelled out (§11).
        <Text className={styles[urgencyOf(daysLeft)]}>
          {t('dashboard.expiring.days', { count: daysLeft })}
        </Text>
      ),
    },
  ];

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
        items={tabs.map(({ key, labelKey, rows }) => ({
          key,
          label: t(labelKey),
          children: (
            <Table<ExpiringRow>
              columns={columns}
              dataSource={rows}
              rowKey="id"
              pagination={false}
              size="small"
              // Wide tables scroll inside their own card instead of pushing the
              // page sideways (docs/ui-conventions.md §10).
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description={t('common.noData')} /> }}
            />
          ),
        }))}
      />
      <div className={styles.footer}>
        {/* Targets a module that ships later; the placeholder page states that. */}
        <Link to="/employees">{t('dashboard.viewAll')} →</Link>
      </div>
    </Card>
  );
}
