import { Card, Col, DatePicker, Progress, Row, Skeleton, Typography } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  GiftOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { DeptStatsCard } from '@/components/dashboard/DeptStatsCard';
import { ExpiringCard, type ExpiringRow } from '@/components/dashboard/ExpiringCard';
import { KpiCard, type KpiTone } from '@/components/dashboard/KpiCard';
import { formatCurrency, formatDate } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import { useEmployeeStats } from '@/hooks/useEmployees';
import { usePayrollSummary } from '@/hooks/usePayroll';
import { useLeaveRequests } from '@/hooks/useLeave';
import { useAttendanceStats } from '@/hooks/useAttendances';
import { useHolidaysByYear } from '@/hooks/useHolidays';
import styles from './DashboardPage.module.css';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

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
  const userName = useAuthStore((s) => s.user?.employee?.fullName ?? s.user?.username ?? '');
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month() + 1;
  const today = now.format('YYYY-MM-DD');

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
  const { data: leaveToday } = useLeaveRequests({
    from: today,
    to: today,
    status: 'approved',
    limit: 1,
  });
  const { data: attStats } = useAttendanceStats({ month: currentMonth, year: currentYear });
  const { data: holidays } = useHolidaysByYear(currentYear);

  const todayDailyStat = attStats?.daily.find((d) => d.date === today);
  const presentToday = todayDailyStat?.counts.present ?? 0;
  const totalEmp = empStats?.total ?? 0;
  const attendancePct = totalEmp > 0 ? Math.round((presentToday / totalEmp) * 100) : 0;

  const leaveTodayCount = leaveToday?.meta.total ?? 0;
  const birthdayCount = empStats?.upcomingBirthdays.length ?? 0;
  const nextHoliday = holidays?.find((h) => h.holidayDate > today) ?? null;

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
    department: req.employee?.departmentName ?? null,
    dueDate: req.startDate,
    daysLeft: Math.max(0, dayjs(req.startDate).diff(now, 'day')),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.greetingRow}>
        <div>
          <Title level={4} className={styles.greeting}>
            {t('dashboard.greeting')} {userName}
          </Title>
          <Text type="secondary">{t('dashboard.subtitle')}</Text>
        </div>
        <RangePicker
          format="DD/MM/YYYY"
          defaultValue={[now.startOf('month'), now]}
          allowClear={false}
        />
      </div>

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
              delta={t('dashboard.kpi.unchanged')}
              hint={t(`dashboard.kpi.${key}Hint`)}
            />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
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
              },
            ]}
          />
        </Col>
        <Col xs={24} xl={10}>
          <DeptStatsCard
            depts={empStats?.byDepartment ?? []}
            total={empStats?.total ?? 0}
            loading={empLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Chấm công hôm nay */}
        <Col xs={24} sm={12} xl={6}>
          <Card variant="borderless" className={styles.miniCard}>
            <div className={styles.miniHeader}>
              <div>
                <Text type="secondary" className={styles.miniLabel}>
                  {t('dashboard.attendance.todayLabel')}
                </Text>
                <div className={styles.miniValue}>
                  {empLoading ? (
                    <Skeleton.Input active size="small" style={{ width: 80 }} />
                  ) : (
                    `${presentToday}/${totalEmp}`
                  )}
                </div>
                <Text type="secondary" className={styles.miniSub}>
                  {t('dashboard.attendance.todayUnit')}
                </Text>
              </div>
              <div className={`${styles.miniIcon} ${styles.iconBlue}`}>
                <ClockCircleOutlined />
              </div>
            </div>
            <Progress
              percent={attendancePct}
              size="small"
              showInfo={false}
              strokeColor="var(--ant-color-primary)"
            />
            <Text className={styles.miniPct}>{attendancePct}%</Text>
          </Card>
        </Col>

        {/* Nghỉ phép hôm nay */}
        <Col xs={24} sm={12} xl={6}>
          <Card variant="borderless" className={styles.miniCard}>
            <div className={styles.miniHeader}>
              <div>
                <Text type="secondary" className={styles.miniLabel}>
                  {t('dashboard.leaveToday.label')}
                </Text>
                <div className={styles.miniValue}>{leaveTodayCount}</div>
                <Text type="secondary" className={styles.miniSub}>
                  {t('dashboard.leaveToday.unit')}
                </Text>
              </div>
              <div className={`${styles.miniIcon} ${styles.iconGreen}`}>
                <CalendarOutlined />
              </div>
            </div>
          </Card>
        </Col>

        {/* Sinh nhật tháng này */}
        <Col xs={24} sm={12} xl={6}>
          <Card variant="borderless" className={styles.miniCard}>
            <div className={styles.miniHeader}>
              <div>
                <Text type="secondary" className={styles.miniLabel}>
                  {t('dashboard.birthday.monthLabel')}
                </Text>
                <div className={styles.miniValue}>{birthdayCount}</div>
                <Text type="secondary" className={styles.miniSub}>
                  {t('dashboard.birthday.monthUnit')}
                </Text>
              </div>
              <div className={`${styles.miniIcon} ${styles.iconOrange}`}>
                <GiftOutlined />
              </div>
            </div>
          </Card>
        </Col>

        {/* Ngày lễ sắp tới */}
        <Col xs={24} sm={12} xl={6}>
          <Card variant="borderless" className={styles.miniCard}>
            <div className={styles.miniHeader}>
              <div>
                <Text type="secondary" className={styles.miniLabel}>
                  {t('dashboard.holiday.upcomingLabel')}
                </Text>
                <div className={styles.miniValue}>
                  {nextHoliday ? formatDate(nextHoliday.holidayDate) : '—'}
                </div>
                <Text type="secondary" className={styles.miniSub}>
                  {nextHoliday?.name ?? '—'}
                </Text>
              </div>
              <div className={`${styles.miniIcon} ${styles.iconRed}`}>
                <CalendarOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
