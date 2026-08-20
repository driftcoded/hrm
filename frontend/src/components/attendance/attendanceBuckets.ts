import type {
  AttendanceStatus,
  AttendanceStatusCounts,
} from '@/types/attendance.types';
import chartColors from './attendanceChart.module.css';

/**
 * Sáu nhóm trạng thái dùng cho biểu đồ chấm công.
 *
 * `late` gộp `late` + `early_leave`: hai nhãn đó là cam và vàng, cách nhau ΔE
 * 7.3 dưới mắt thường nên khi tô thành mảng màu là một màu. Bảng bên dưới vẫn
 * tách riêng hai trạng thái.
 *
 * THỨ TỰ CỐ ĐỊNH và là cơ chế an toàn màu — xem ghi chú `--hrm-attendance-*`
 * trong styles/tokens.css trước khi đổi.
 */
const ATTENDANCE_BUCKETS = [
  { key: 'present', statuses: ['present'] },
  { key: 'wfh', statuses: ['wfh'] },
  { key: 'late', statuses: ['late', 'early_leave'] },
  { key: 'leave', statuses: ['leave'] },
  { key: 'absent', statuses: ['absent'] },
  { key: 'holiday', statuses: ['holiday'] },
] as const satisfies ReadonlyArray<{
  key: string;
  statuses: ReadonlyArray<AttendanceStatus>;
}>;

type AttendanceBucketKey = (typeof ATTENDANCE_BUCKETS)[number]['key'];

/**
 * Nhóm thứ bảy: nhân viên chưa có dòng chấm công nào trong ngày.
 *
 * Không phải một trạng thái — nó là phần chênh giữa số nhân viên và số bản ghi,
 * và là thứ giữ cho tỉ lệ nói đúng sự thật. Thiếu nó thì một ngày mới có 1 dòng
 * dữ liệu vẫn hiện "100%" như một ngày đã chấm đủ.
 */
const ATTENDANCE_NO_DATA_KEY = 'noData';

type AttendanceChartKey = AttendanceBucketKey | typeof ATTENDANCE_NO_DATA_KEY;

interface AttendanceChartEntry {
  key: AttendanceChartKey;
  value: number;
}

/** Cộng số bản ghi của từng nhóm từ bảng đếm theo trạng thái. */
function toBucketCounts(
  counts: AttendanceStatusCounts,
): Record<AttendanceBucketKey, number> {
  const result = {} as Record<AttendanceBucketKey, number>;

  for (const bucket of ATTENDANCE_BUCKETS) {
    result[bucket.key] = bucket.statuses.reduce(
      (sum, status) => sum + (counts[status] ?? 0),
      0,
    );
  }

  return result;
}

/**
 * Mẫu số của biểu đồ: số nhân viên, hoặc số bản ghi nếu nhiều hơn.
 *
 * Tháng cũ có thể nhiều bản ghi hơn số nhân viên hiện còn làm việc (người đã
 * nghỉ vẫn có ngày công), khi đó lấy số bản ghi để tỉ lệ không vượt 100%.
 */
export function chartDenominator(recordCount: number, employeeCount: number): number {
  return Math.max(recordCount, employeeCount);
}

/** Sáu nhóm trạng thái + phần chưa có dữ liệu, theo đúng thứ tự vẽ. */
export function toChartEntries(
  counts: AttendanceStatusCounts,
  recordCount: number,
  employeeCount: number,
): AttendanceChartEntry[] {
  const buckets = toBucketCounts(counts);

  return [
    ...ATTENDANCE_BUCKETS.map((bucket) => ({
      key: bucket.key as AttendanceChartKey,
      value: buckets[bucket.key],
    })),
    {
      key: ATTENDANCE_NO_DATA_KEY,
      value: Math.max(employeeCount - recordCount, 0),
    },
  ];
}

/** Class màu của từng nhóm, đặt `--slice` cho vòng tròn. */
export const CHART_CLASS: Record<AttendanceChartKey, string> = {
  present: chartColors.present,
  wfh: chartColors.wfh,
  late: chartColors.late,
  leave: chartColors.leave,
  absent: chartColors.absent,
  holiday: chartColors.holiday,
  [ATTENDANCE_NO_DATA_KEY]: chartColors.noData,
};
