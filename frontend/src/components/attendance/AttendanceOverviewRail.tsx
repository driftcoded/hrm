import { useMemo } from 'react';
import { Alert, Button, Card, DatePicker, Skeleton } from 'antd';
import {
  ClockCircleOutlined,
  FieldTimeOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { DonutChart } from '@/components/charts/DonutChart';
import type { DonutSlice } from '@/components/charts/donutSlices';
import { formatNumber, formatPercent } from '@/utils/format';
import type { AttendanceStats } from '@/types/attendance.types';
import {
  CHART_CLASS,
  chartDenominator,
  toChartEntries,
} from './attendanceBuckets';
import styles from './AttendanceOverviewRail.module.css';

/**
 * Cột phải của màn chấm công: tỉ lệ trong ngày + số liệu tháng.
 *
 * Cùng khuôn với `OverviewRail` của màn Nhân viên — vòng tròn xếp dọc, rồi tới
 * thẻ số liệu nhanh.
 *
 * Mẫu số là SỐ NHÂN VIÊN, không phải số bản ghi đã chấm: ngày mới nhập một dòng
 * mà chia cho chính một dòng đó thì luôn ra 100%.
 */

export interface AttendanceOverviewRailProps {
  stats?: AttendanceStats;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** `YYYY-MM-DD` — ngày đang xem. `null` khi chưa có số liệu. */
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function AttendanceOverviewRail({
  stats,
  isLoading,
  isError,
  onRetry,
  selectedDate,
  onSelectDate,
}: AttendanceOverviewRailProps) {
  const { t } = useTranslation();

  const day =
    stats && selectedDate
      ? (stats.daily.find((entry) => entry.date === selectedDate) ?? null)
      : null;

  const slices = useMemo<DonutSlice[]>(() => {
    if (!stats || !day) {
      return [];
    }

    return toChartEntries(day.counts, day.total, stats.employeeCount).map(
      (entry, index) => ({
        key: entry.key,
        label: t(`attendance.charts.bucket.${entry.key}`),
        value: entry.value,
        slot: (index + 1) as DonutSlice['slot'],
        className: CHART_CLASS[entry.key],
      }),
    );
  }, [stats, day, t]);

  if (isError) {
    return (
      <Alert
        type="warning"
        showIcon
        title={t('attendance.charts.loadError')}
        action={
          <Button size="small" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  if (isLoading || !stats || !selectedDate) {
    return (
      <Card variant="borderless" title={t('attendance.charts.dailyTitle')}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  const dayTotal = day
    ? chartDenominator(day.total, stats.employeeCount)
    : stats.employeeCount;

  // Ngày có ít nhất một dòng chấm công — nói lên độ phủ dữ liệu của tháng.
  const daysWithData = stats.daily.filter((entry) => entry.total > 0).length;

  return (
    <div className={styles.rail}>
      <Card
        variant="borderless"
        title={t('attendance.charts.dailyTitle')}
        extra={
          <DatePicker
            allowClear={false}
            format="DD/MM"
            className={styles.datePicker}
            value={dayjs(selectedDate)}
            // Khoá trong tháng đang lọc: số liệu chỉ có của tháng này.
            minDate={dayjs(stats.from)}
            maxDate={dayjs(stats.to)}
            onChange={(next: Dayjs | null) =>
              next && onSelectDate(next.format('YYYY-MM-DD'))
            }
            aria-label={t('attendance.charts.datePickerLabel')}
          />
        }
      >
        <DonutChart
          layout="stacked"
          slices={slices}
          total={dayTotal}
          centerLabel={t('attendance.charts.centerLabel')}
          centerCaption={t('attendance.charts.unit')}
          figureLabel={t('attendance.charts.dailyFigureLabel', {
            date: dayjs(selectedDate).format('DD/MM/YYYY'),
          })}
          formatSliceValue={(value, percent) =>
            t('attendance.charts.legendValue', {
              count: value,
              percent: formatPercent(percent),
            })
          }
          emptyText={t('attendance.charts.dailyEmpty')}
        />

        {/* Nói thẳng mẫu số, để không ai đọc "100%" thành "cả công ty đi làm
            đủ" khi ngày đó mới có vài dòng dữ liệu. */}
        <p className={styles.denominator}>
          {t('attendance.charts.denominator', { count: stats.employeeCount })}
        </p>
      </Card>

      <Card variant="borderless" title={t('attendance.charts.monthStats')}>
        <ul className={styles.statList}>
          <li className={styles.statRow}>
            <FieldTimeOutlined className={styles.statIconBlue} aria-hidden="true" />
            <span className={styles.statLabel}>{t('attendance.charts.workHours')}</span>
            <span className={styles.statValue}>
              {formatNumber(stats.totalWorkHours)}
            </span>
          </li>
          <li className={styles.statRow}>
            <ClockCircleOutlined
              className={styles.statIconOrange}
              aria-hidden="true"
            />
            <span className={styles.statLabel}>
              {t('attendance.charts.overtimeHours')}
            </span>
            <span className={styles.statValue}>
              {formatNumber(stats.totalOvertimeHours)}
            </span>
          </li>
          <li className={styles.statRow}>
            <TeamOutlined className={styles.statIconTeal} aria-hidden="true" />
            <span className={styles.statLabel}>
              {t('attendance.charts.employeeCount')}
            </span>
            <span className={styles.statValue}>
              {formatNumber(stats.employeeCount)}
            </span>
          </li>
          <li className={styles.statRow}>
            <span className={styles.statLabel}>
              {t('attendance.charts.daysWithData')}
            </span>
            <span className={styles.statValue}>
              {t('attendance.charts.daysWithDataValue', {
                covered: daysWithData,
                total: stats.daily.length,
              })}
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
