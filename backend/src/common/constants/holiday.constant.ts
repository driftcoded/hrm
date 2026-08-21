import type { HolidayRule } from '@/common/utils/vietnam-holidays.util';

/**
 * Sáu kỳ nghỉ pháp định theo Điều 112 BLLĐ 2019 — tổng 11 ngày/năm.
 *
 * Đây là toàn bộ "ngày lễ" cần khai của một công ty Việt Nam. Ngày cụ thể của
 * từng năm do `resolveHolidays` tính ra, kể cả Tết và Giỗ Tổ theo âm lịch.
 *
 * HAI THỨ LUẬT KHÔNG ẤN ĐỊNH, Chính phủ chốt lại từng năm: nghỉ Tết bắt đầu
 * sớm mấy ngày, và nghỉ thêm ngày liền kề nào của 2/9. Giá trị dưới đây là lệ
 * thường; năm nào khác thì thêm một dòng cùng `code` mang đúng năm đó.
 */
export const STATUTORY_HOLIDAY_RULES: readonly Omit<
  HolidayRule,
  'year' | 'isActive'
>[] = [
  {
    code: 'NEW_YEAR',
    name: 'Tết Dương lịch',
    type: 'national',
    calendar: 'solar',
    month: 1,
    day: 1,
    offsetDays: 0,
    durationDays: 1,
    isPaid: true,
    sortOrder: 1,
    note: 'Điều 112 khoản 1 điểm a',
  },
  {
    code: 'TET',
    name: 'Tết Nguyên đán',
    type: 'national',
    calendar: 'lunar',
    month: 1,
    day: 1,
    // Neo vào mùng 1, nghỉ sớm 1 ngày, tổng 5 ngày ⇒ 29 Chạp + mùng 1…4.
    offsetDays: -1,
    durationDays: 5,
    isPaid: true,
    sortOrder: 2,
    note: 'Điều 112 khoản 1 điểm b — 5 ngày, Chính phủ chốt ngày bắt đầu mỗi năm',
  },
  {
    code: 'HUNG_KINGS',
    name: 'Giỗ Tổ Hùng Vương',
    type: 'national',
    calendar: 'lunar',
    month: 3,
    day: 10,
    offsetDays: 0,
    durationDays: 1,
    isPaid: true,
    sortOrder: 3,
    note: 'Điều 112 khoản 1 điểm e',
  },
  {
    code: 'REUNIFICATION',
    name: 'Ngày Chiến thắng',
    type: 'national',
    calendar: 'solar',
    month: 4,
    day: 30,
    offsetDays: 0,
    durationDays: 1,
    isPaid: true,
    sortOrder: 4,
    note: 'Điều 112 khoản 1 điểm c — Giải phóng miền Nam 30/4',
  },
  {
    code: 'LABOUR_DAY',
    name: 'Ngày Quốc tế Lao động',
    type: 'national',
    calendar: 'solar',
    month: 5,
    day: 1,
    offsetDays: 0,
    durationDays: 1,
    isPaid: true,
    sortOrder: 5,
    note: 'Điều 112 khoản 1 điểm d',
  },
  {
    code: 'NATIONAL_DAY',
    name: 'Ngày Quốc khánh',
    type: 'national',
    calendar: 'solar',
    month: 9,
    day: 2,
    // Neo vào 2/9, nghỉ sớm 1 ngày, tổng 2 ngày ⇒ 1/9 + 2/9.
    offsetDays: -1,
    durationDays: 2,
    isPaid: true,
    sortOrder: 6,
    note: 'Điều 112 khoản 1 điểm đ — 2 ngày, Chính phủ chọn ngày liền kề mỗi năm',
  },
];
