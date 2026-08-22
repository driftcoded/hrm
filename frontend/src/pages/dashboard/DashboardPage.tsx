import { Col, Row } from 'antd';
import {
  DollarCircleOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { BirthdayCard } from '@/components/dashboard/BirthdayCard';
import { ExpiringCard, type ExpiringRow } from '@/components/dashboard/ExpiringCard';
import { KpiCard, type KpiTone } from '@/components/dashboard/KpiCard';
import { formatCurrency } from '@/utils/format';
import { useEmployeeStats } from '@/hooks/useEmployees';
import { usePayrollSummary } from '@/hooks/usePayroll';
import { useLeaveRequests } from '@/hooks/useLeave';
import styles from './DashboardPage.module.css';

interface KpiDef {
  key: string;
  value: number | null;
  icon: ReactNode;
  tone: KpiTone;
  loading: boolean;
  currency?: boolean;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month() + 1;

  const { data: empStats, isLoading: empLoading } = useEmployeeStats();
  const { data: payrollSummary, isLoading: payrollLoading } = usePayrollSummary(
    currentYear,
    currentMonth,
  );
  const { data: pendingLeave, isLoading: leaveLoading } = useLeaveRequests({
    status: 'pending',
    limit: 5,
    sort: 'startDate',
    order: 'asc',
  });

  const kpis: KpiDef[] = [
    {
      key: 'totalEmployees',
      value: empStats?.total ?? null,
      icon: <TeamOutlined />,
      tone: 'blue',
      loading: empLoading,
    },
    {
      key: 'activeEmployees',
      value: empStats?.byStatus.active ?? null,
      icon: <UserSwitchOutlined />,
      tone: 'green',
      loading: empLoading,
    },
    {
      key: 'hiredLast30Days',
      value: empStats?.hiredLast30Days ?? null,
      icon: <UserAddOutlined />,
      tone: 'cyan',
      loading: empLoading,
    },
    {
      key: 'payrollCost',
      value: payrollSummary?.totalNet ?? null,
      icon: <DollarCircleOutlined />,
      tone: 'purple',
      loading: payrollLoading,
      currency: true,
    },
  ];

  const pendingLeaveRows: ExpiringRow[] = (pendingLeave?.items ?? []).map((req) => ({
    id: req.id,
    fullName: req.employee?.fullName ?? '',
    position: req.leaveType?.name ?? null,
    department: null,
    dueDate: req.startDate,
    daysLeft: Math.max(0, dayjs(req.startDate).diff(now, 'day')),
  }));

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <Row gutter={[16, 16]}>
        {kpis.map(({ key, value, icon, tone, loading, currency }) => (
          <Col key={key} xs={24} sm={12} xl={6}>
            <KpiCard
              icon={icon}
              tone={tone}
              label={t(`dashboard.kpi.${key}`)}
              value={
                loading
                  ? '…'
                  : value === null
                    ? '—'
                    : currency
                      ? formatCurrency(value)
                      : value.toLocaleString('vi-VN')
              }
              delta={null}
              hint={t(`dashboard.kpi.${key}Hint`)}
            />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className={styles.bottomRow}>
        <Col xs={24} xl={14}>
          <ExpiringCard
            tabs={[
              {
                key: 'probation',
                labelKey: 'dashboard.expiring.tabs.probation',
                countOnly: empStats?.probationEndingSoon,
                windowDays: empStats?.windowDays,
                loading: empLoading,
              },
              {
                key: 'contract',
                labelKey: 'dashboard.expiring.tabs.contract',
                countOnly: empStats?.contractsExpiringSoon,
                windowDays: empStats?.windowDays,
                loading: empLoading,
              },
              {
                key: 'leave',
                labelKey: 'dashboard.expiring.tabs.leave',
                rows: pendingLeaveRows,
                loading: leaveLoading,
                dueDateLabelKey: 'dashboard.expiring.startDate',
              },
            ]}
          />
        </Col>
        <Col xs={24} xl={10}>
          <BirthdayCard
            birthdays={empStats?.upcomingBirthdays ?? []}
            loading={empLoading}
          />
        </Col>
      </Row>

    </>
  );
}
