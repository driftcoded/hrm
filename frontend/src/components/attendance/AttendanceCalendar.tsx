import { useMemo } from 'react';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { AttendanceRecord, OvertimeRequest } from '@/types/attendance.types';
import styles from './AttendanceCalendar.module.css';

/**
 * Lịch chấm công một tháng (PLAN 4.2 — "hiển thị có đi làm / vắng / OT").
 *
 * KHÔNG dùng `Calendar` của AntD: component đó dựng bảng của CẢ năm và cho cell
 * render tự do, còn thứ cần ở đây là một lưới 7 cột chỉ của một tháng, mỗi ô
 * mang đúng một trạng thái. Tự dựng lưới nhỏ hơn, đọc được, và không kéo theo
 * cách AntD xử lý locale/tuần bắt đầu từ đâu.
 *
 * TUẦN BẮT ĐẦU TỪ THỨ HAI. Lịch mặc định của phần lớn thư viện bắt đầu Chủ
 * nhật; ở Việt Nam tuần làm việc là T2–T6 nên để Chủ nhật ở đầu sẽ tách đôi
 * cuối tuần ra hai đầu hàng và nhìn không ra tuần làm việc.
 *
 * NGÀY CHƯA TỚI KHÔNG BAO GIỜ LÀ "VẮNG". Ô của ngày tương lai để trống — tô
 * chúng thành vắng là kết tội người ta vì những ngày chưa xảy ra.
 */

export interface AttendanceCalendarProps {
  month: number;
  year: number;
  records: AttendanceRecord[];
  /** Đơn làm thêm ĐÃ DUYỆT trong tháng — vẽ dấu chấm ở góc ô. */
  approvedOvertime?: OvertimeRequest[];
  /** `YYYY-MM-DD` — ngày đang chọn. */
  selectedDate?: string | null;
  onSelectDate?: (date: string, record: AttendanceRecord | null) => void;
}

type DayKind =
  | 'present'
  | 'late'
  | 'earlyLeave'
  | 'absent'
  | 'leave'
  | 'holiday'
  | 'wfh'
  | 'weekend'
  | 'future'
  | 'empty';

interface DayCell {
  /** `YYYY-MM-DD`, hoặc `null` cho ô đệm đầu/cuối tháng. */
  date: string | null;
  dayOfMonth: number | null;
  kind: DayKind;
  record: AttendanceRecord | null;
  overtimeHours: number;
}

export function AttendanceCalendar({
  month,
  year,
  records,
  approvedOvertime = [],
  selectedDate,
  onSelectDate,
}: AttendanceCalendarProps) {
  const { t } = useTranslation();

  const cells = useMemo(
    () => buildCells(month, year, records, approvedOvertime),
    [month, year, records, approvedOvertime],
  );

  const weekdayLabels = t('attendance.calendar.weekdays', {
    returnObjects: true,
  }) as string[];

  return (
    <div className={styles.calendar}>
      <div className={styles.weekdays}>
        {weekdayLabels.map((label) => (
          <div key={label} className={styles.weekday}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell.date) {
            return <div key={`pad-${index}`} className={styles.pad} aria-hidden="true" />;
          }

          const isSelected = cell.date === selectedDate;
          const label = t(`attendance.calendar.kind.${cell.kind}`);

          return (
            <Tooltip key={cell.date} title={buildTooltip(cell, label)}>
              <button
                type="button"
                className={[
                  styles.day,
                  styles[cell.kind],
                  isSelected ? styles.selected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${dayjs(cell.date).format('DD/MM/YYYY')} — ${label}`}
                aria-pressed={isSelected}
                onClick={() => onSelectDate?.(cell.date as string, cell.record)}
              >
                <span className={styles.dayNumber}>{cell.dayOfMonth}</span>
                {cell.record?.checkIn && (
                  <span className={styles.dayTime}>{cell.record.checkIn}</span>
                )}
                {cell.overtimeHours > 0 && (
                  <span
                    className={styles.overtimeDot}
                    aria-label={t('attendance.calendar.overtimeMark', {
                      hours: cell.overtimeHours,
                    })}
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function buildTooltip(cell: DayCell, kindLabel: string): string {
  const parts = [dayjs(cell.date ?? undefined).format('DD/MM/YYYY'), kindLabel];

  if (cell.record?.checkIn) {
    parts.push(`${cell.record.checkIn} – ${cell.record.checkOut ?? '…'}`);
  }

  return parts.join(' · ');
}

function buildCells(
  month: number,
  year: number,
  records: AttendanceRecord[],
  approvedOvertime: OvertimeRequest[],
): DayCell[] {
  const byDate = new Map(records.map((record) => [record.workDate, record]));
  const overtimeByDate = new Map<string, number>();

  for (const request of approvedOvertime) {
    overtimeByDate.set(
      request.workDate,
      (overtimeByDate.get(request.workDate) ?? 0) + request.totalHours,
    );
  }

  const first = dayjs(`${year}-${`${month}`.padStart(2, '0')}-01`);
  const daysInMonth = first.daysInMonth();
  // `day()` trả 0 cho Chủ nhật; đổi sang tuần bắt đầu Thứ Hai → 0 = T2, 6 = CN.
  const leadingPads = (first.day() + 6) % 7;
  const today = dayjs().format('YYYY-MM-DD');

  const cells: DayCell[] = Array.from({ length: leadingPads }, () => ({
    date: null,
    dayOfMonth: null,
    kind: 'empty' as DayKind,
    record: null,
    overtimeHours: 0,
  }));

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = first.date(day).format('YYYY-MM-DD');
    const record = byDate.get(date) ?? null;
    const dayOfWeek = first.date(day).day();

    cells.push({
      date,
      dayOfMonth: day,
      kind: resolveKind(record, date, today, dayOfWeek),
      record,
      overtimeHours: overtimeByDate.get(date) ?? 0,
    });
  }

  return cells;
}

function resolveKind(
  record: AttendanceRecord | null,
  date: string,
  today: string,
  dayOfWeek: number,
): DayKind {
  if (record) {
    switch (record.status) {
      case 'late':
        return 'late';
      case 'early_leave':
        return 'earlyLeave';
      case 'leave':
        return 'leave';
      case 'holiday':
        return 'holiday';
      case 'wfh':
        return 'wfh';
      case 'absent':
        return 'absent';
      default:
        return 'present';
    }
  }

  // Ngày chưa tới thì để trống — không phải vắng.
  if (date > today) {
    return 'future';
  }

  return dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'absent';
}
