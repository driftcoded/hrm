import { Alert, Col, DatePicker, Row } from 'antd';
import {
  ApartmentOutlined,
  DollarCircleOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActivityCard } from '@/components/dashboard/ActivityCard';
import { ExpiringCard } from '@/components/dashboard/ExpiringCard';
import { KpiCard, type KpiTone } from '@/components/dashboard/KpiCard';
import { formatCurrency, formatPercent } from '@/utils/format';
import {
  EXPIRING_CONTRACTS,
  EXPIRING_PROBATION,
  KPIS,
  PENDING_LEAVE,
  RECENT_ACTIVITY,
} from './mockData';
import styles from './DashboardPage.module.css';

const { RangePicker } = DatePicker;

/** Icon + tint per KPI, keyed by the `key` in mockData. */
const KPI_VISUALS: Record<string, { icon: ReactNode; tone: KpiTone }> = {
  totalEmployees: { icon: <TeamOutlined />, tone: 'blue' },
  departments: { icon: <ApartmentOutlined />, tone: 'green' },
  activeEmployees: { icon: <UserSwitchOutlined />, tone: 'cyan' },
  payrollCost: { icon: <DollarCircleOutlined />, tone: 'purple' },
};

/**
 * HR overview dashboard.
 *
 * NOTE: every figure on this page comes from `mockData.ts` — none of the
 * required endpoints exist yet (employees is Giai đoạn 3, attendance 4, leave 5,
 * payroll 6, and the dashboard itself is 8.2). The banner below says so on
 * screen, so nobody mistakes these for live numbers. Charts are deliberately
 * out of scope for now.
 */
export function DashboardPage() {
  const { t } = useTranslation();

  const currency = (value: number) => formatCurrency(value);

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <RangePicker
            format="DD/MM/YYYY"
            // Placeholder range: this filter has nothing to filter until the
            // dashboard is wired to real endpoints.
            defaultValue={[dayjs().startOf('month'), dayjs()]}
            allowClear={false}
          />
        }
      />

      <Alert
        className={styles.notice}
        type="info"
        showIcon
        title={t('dashboard.placeholderNotice')}
      />

      <Row gutter={[16, 16]}>
        {KPIS.map(({ key, value, delta, deltaKind }) => {
          const visual = KPI_VISUALS[key];
          const formattedValue = key === 'payrollCost' ? currency(value) : value.toLocaleString('vi-VN');
          const formattedDelta =
            delta === null
              ? null
              : t('dashboard.kpi.deltaVsLastMonth', {
                  value:
                    deltaKind === 'percent'
                      ? formatPercent(delta)
                      : delta.toLocaleString('vi-VN'),
                });

          return (
            <Col key={key} xs={24} sm={12} xl={6}>
              <KpiCard
                icon={visual?.icon}
                tone={visual?.tone ?? 'blue'}
                label={t(`dashboard.kpi.${key}`)}
                value={formattedValue}
                delta={formattedDelta}
                hint={t(`dashboard.kpi.${key}Hint`)}
              />
            </Col>
          );
        })}
      </Row>

      <Row gutter={[16, 16]} className={styles.bottomRow}>
        <Col xs={24} xl={14}>
          <ExpiringCard
            tabs={[
              {
                key: 'probation',
                labelKey: 'dashboard.expiring.tabs.probation',
                rows: EXPIRING_PROBATION,
              },
              {
                key: 'contract',
                labelKey: 'dashboard.expiring.tabs.contract',
                rows: EXPIRING_CONTRACTS,
              },
              {
                key: 'leave',
                labelKey: 'dashboard.expiring.tabs.leave',
                rows: PENDING_LEAVE,
              },
            ]}
          />
        </Col>
        <Col xs={24} xl={10}>
          <ActivityCard items={RECENT_ACTIVITY} />
        </Col>
      </Row>
    </>
  );
}
