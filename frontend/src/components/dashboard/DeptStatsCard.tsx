import { Card, Empty, Skeleton, Typography } from 'antd';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { DepartmentHeadcount } from '@/types/employee.types';
import styles from './DeptStatsCard.module.css';

const { Text } = Typography;

const DEPT_COLORS = [
  '#20c997',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#13c2c2',
  '#1677ff',
  '#f5222d',
  '#eb2f96',
];

const RADIUS = 56;
const CX = 80;
const CY = 80;
const STROKE_WIDTH = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface DeptStatsCardProps {
  depts: DepartmentHeadcount[];
  total: number;
  loading?: boolean;
}

export function DeptStatsCard({ depts, total, loading }: DeptStatsCardProps) {
  const { t } = useTranslation();

  let cumulativeAngle = -90;

  return (
    <Card
      variant="borderless"
      className={styles.card}
      title={t('dashboard.deptStats.title')}
      extra={<Link to="/employees">{t('dashboard.deptStats.viewDetail')}</Link>}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : depts.length === 0 ? (
        <Empty description={t('common.noData')} />
      ) : (
        <div className={styles.body}>
          <div className={styles.donutWrap}>
            <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
              {depts.map((dept, i) => {
                const pct = total > 0 ? dept.count / total : 0;
                const dash = pct * CIRCUMFERENCE;
                const rotation = cumulativeAngle;
                cumulativeAngle += pct * 360;
                return (
                  <circle
                    key={dept.departmentId}
                    cx={CX}
                    cy={CY}
                    r={RADIUS}
                    fill="none"
                    stroke={DEPT_COLORS[i % DEPT_COLORS.length]}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                    transform={`rotate(${rotation} ${CX} ${CY})`}
                  />
                );
              })}
              <text x={CX} y={CY - 6} textAnchor="middle" className={styles.donutTotal}>
                {total}
              </text>
              <text x={CX} y={CY + 14} textAnchor="middle" className={styles.donutLabel}>
                {t('dashboard.deptStats.totalEmployees')}
              </text>
            </svg>
          </div>

          <div className={styles.table}>
            {depts.map((dept, i) => (
              <div key={dept.departmentId} className={styles.row}>
                <span
                  className={styles.dot}
                  style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}
                  aria-hidden="true"
                />
                <Text className={styles.deptName}>{dept.departmentName}</Text>
                <Text strong className={styles.deptCount}>{dept.count}</Text>
                <Text type="secondary" className={styles.deptPct}>
                  {total > 0 ? `${((dept.count / total) * 100).toFixed(1)}%` : '—'}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
