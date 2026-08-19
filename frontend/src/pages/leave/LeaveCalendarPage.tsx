import { useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Empty, Skeleton, Tag, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveCalendar } from '@/hooks/useLeave';
import type { LeaveRequest } from '@/types/leave.types';
import styles from './LeaveCalendarPage.module.css';

/**
 * `/leave/calendar` — ai đang nghỉ trong tháng (PLAN 5.2).
 *
 * CHỈ ĐƠN ĐÃ DUYỆT. Một đơn còn chờ duyệt chưa cho phép ai nghỉ cả, và để nó
 * lên lịch sẽ khiến trưởng phòng xếp việc quanh một ngày nghỉ chưa chắc xảy ra.
 *
 * BỐ CỤC LÀ MỘT DÒNG MỘT NGƯỜI, KHÔNG PHẢI LƯỚI NGÀY. Câu hỏi thật của người
 * xem là "tuần này ai vắng, từ hôm nào tới hôm nào" — một dải ngang trên trục
 * ngày trả lời câu đó ngay, còn lưới 30 ô thì bắt họ tự ghép các ô lại. Cách
 * này cũng chịu được kỳ nghỉ bắc qua đầu/cuối tháng: dải bị cắt ở mép và vẫn
 * đọc được là nó còn kéo dài ra ngoài.
 */
export function LeaveCalendarPage() {
  const { t } = useTranslation();
  const resolveError = useApiErrorMessage();

  const [cursor, setCursor] = useState<Dayjs>(dayjs());

  const from = cursor.startOf('month').format('YYYY-MM-DD');
  const to = cursor.endOf('month').format('YYYY-MM-DD');
  const daysInMonth = cursor.daysInMonth();

  const { data, isLoading, isError, error, refetch } = useLeaveCalendar(from, to);

  const requests = useMemo(() => data ?? [], [data]);

  return (
    <div className={styles.page}>
      <Card
        variant="borderless"
        title={t('leave.calendar.title')}
        extra={
          <DatePicker
            picker="month"
            allowClear={false}
            value={cursor}
            format="MM/YYYY"
            onChange={(next) => next && setCursor(next)}
          />
        }
      >
        {isError ? (
          <Alert
            type="error"
            showIcon
            title={resolveError(error) || t('leave.calendar.loadError')}
            action={
              <Button size="small" onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : requests.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('leave.calendar.empty')}
          />
        ) : (
          <div className={styles.chart}>
            <div className={styles.axis} aria-hidden="true">
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
                (day) => {
                  const date = cursor.date(day);
                  const isWeekend = date.day() === 0 || date.day() === 6;

                  return (
                    <span
                      key={day}
                      className={isWeekend ? styles.axisWeekend : styles.axisDay}
                    >
                      {day}
                    </span>
                  );
                },
              )}
            </div>

            {requests.map((request) => (
              <LeaveBar
                key={request.id}
                request={request}
                cursor={cursor}
                daysInMonth={daysInMonth}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LeaveBar({
  request,
  cursor,
  daysInMonth,
}: {
  request: LeaveRequest;
  cursor: Dayjs;
  daysInMonth: number;
}) {
  const { t } = useTranslation();

  const monthStart = cursor.startOf('month');
  const monthEnd = cursor.endOf('month');

  /*
   * Cắt kỳ nghỉ về trong tháng đang xem. Không cắt thì một kỳ nghỉ bắt đầu từ
   * tháng trước sẽ cho `startColumn` âm và dải trôi ra ngoài lưới.
   */
  const start = dayjs(request.startDate).isBefore(monthStart)
    ? monthStart
    : dayjs(request.startDate);
  const end = dayjs(request.endDate).isAfter(monthEnd)
    ? monthEnd
    : dayjs(request.endDate);

  const startColumn = start.date();
  const span = end.date() - startColumn + 1;

  const continuesBefore = dayjs(request.startDate).isBefore(monthStart);
  const continuesAfter = dayjs(request.endDate).isAfter(monthEnd);

  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <span className={styles.rowName}>{request.employee?.fullName ?? '—'}</span>
        <span className={styles.rowMeta}>
          {request.employee?.departmentName ?? ''}
        </span>
      </div>

      <div
        className={styles.track}
        style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}
      >
        <Tooltip
          title={
            <>
              {request.leaveType?.name}
              <br />
              {dayjs(request.startDate).format('DD/MM')} –{' '}
              {dayjs(request.endDate).format('DD/MM/YYYY')} · {request.totalDays}{' '}
              {t('leave.calendar.days')}
              <br />
              {request.reason}
            </>
          }
        >
          <div
            className={[
              styles.bar,
              continuesBefore ? styles.openStart : '',
              continuesAfter ? styles.openEnd : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ gridColumn: `${startColumn} / span ${span}` }}
          >
            <span className={styles.barLabel}>
              {request.leaveType?.code === 'ANNUAL' ? (
                <Tag color="blue" bordered={false}>
                  {request.totalDays}
                </Tag>
              ) : (
                <Tag color="purple" bordered={false}>
                  {request.leaveType?.name ?? ''}
                </Tag>
              )}
            </span>
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
