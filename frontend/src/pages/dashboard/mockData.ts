/**
 * PLACEHOLDER DASHBOARD DATA — NOT REAL, NOT FETCHED.
 *
 * TODO(giai-doan-8): replace every export here with real API data. None of the
 * required endpoints exist yet; the dashboard itself is PLAN.md item 8.2. The
 * numbers below are shaped like the real payloads so swapping them out is a
 * matter of wiring hooks, not rewriting components:
 *
 *   headcount / activeCount  -> GET /employees            (Giai đoạn 3)
 *   departmentCount + split  -> GET /departments          (Giai đoạn 2)
 *   attendance breakdown     -> GET /attendances          (Giai đoạn 4)
 *   probation / contract due -> GET /contracts            (Giai đoạn 3)
 *   pending leave requests   -> GET /leave-requests       (Giai đoạn 5)
 *   payroll cost + trend     -> GET /salaries             (Giai đoạn 6)
 *   activity feed            -> GET /audit-logs           (Giai đoạn 8)
 *
 * Everything fake lives in THIS file on purpose: no component hardcodes a
 * number, and no fake service pretends to fetch, so there is exactly one place
 * to delete when the real endpoints land.
 */

export interface KpiDatum {
  key: string;
  value: number;
  /** Percent or absolute change vs the previous month; `null` = unchanged. */
  delta: number | null;
  deltaKind: 'percent' | 'absolute';
}

export interface SeriesPoint {
  month: string;
  /** VNĐ. Charted in millions — the card states the unit. */
  cost: number;
}

export interface BreakdownSlice {
  key: string;
  value: number;
}

export interface ExpiringRow {
  id: number;
  fullName: string;
  position: string;
  department: string;
  dueDate: string;
  daysLeft: number;
}

export type ActivityKind = 'employee' | 'leave' | 'payroll' | 'contract';

export interface ActivityItem {
  id: number;
  kind: ActivityKind;
  /** i18n key + params, so the feed is translatable rather than baked prose. */
  titleKey: string;
  titleParams: Record<string, string>;
  detailKey: string;
  detailParams: Record<string, string>;
  /** ISO timestamp — rendered relative via dayjs. */
  at: string;
}

export const KPIS: KpiDatum[] = [
  { key: 'totalEmployees', value: 256, delta: 12, deltaKind: 'absolute' },
  { key: 'departments', value: 12, delta: null, deltaKind: 'absolute' },
  { key: 'activeEmployees', value: 238, delta: 8, deltaKind: 'absolute' },
  { key: 'payrollCost', value: 3_245_600_000, delta: 6.4, deltaKind: 'percent' },
];

export const PAYROLL_TREND: SeriesPoint[] = [
  { month: '2025-12', cost: 1_180_000_000 },
  { month: '2026-01', cost: 1_640_000_000 },
  { month: '2026-02', cost: 2_390_000_000 },
  { month: '2026-03', cost: 2_520_000_000 },
  { month: '2026-04', cost: 2_980_000_000 },
  { month: '2026-05', cost: 3_245_600_000 },
];

export const ATTENDANCE_BREAKDOWN: BreakdownSlice[] = [
  { key: 'onTime', value: 3_687 },
  { key: 'late', value: 892 },
  { key: 'earlyLeave', value: 497 },
  { key: 'absent', value: 210 },
  { key: 'onLeave', value: 90 },
];

export const DEPARTMENT_BREAKDOWN: BreakdownSlice[] = [
  { key: 'product', value: 72 },
  { key: 'sales', value: 51 },
  { key: 'marketing', value: 46 },
  { key: 'operations', value: 38 },
  { key: 'hr', value: 28 },
  { key: 'finance', value: 21 },
];

export const EXPIRING_PROBATION: ExpiringRow[] = [
  {
    id: 1,
    fullName: 'Trần Quang Huy',
    position: 'Lập trình viên',
    department: 'Phát triển sản phẩm',
    dueDate: '2026-05-25',
    daysLeft: 3,
  },
  {
    id: 2,
    fullName: 'Nguyễn Thu Hà',
    position: 'Nhân viên kinh doanh',
    department: 'Kinh doanh',
    dueDate: '2026-05-28',
    daysLeft: 6,
  },
  {
    id: 3,
    fullName: 'Lê Minh Đức',
    position: 'Thiết kế UI/UX',
    department: 'Marketing',
    dueDate: '2026-06-02',
    daysLeft: 11,
  },
];

export const EXPIRING_CONTRACTS: ExpiringRow[] = [
  {
    id: 4,
    fullName: 'Phạm Văn Nam',
    position: 'Trưởng nhóm vận hành',
    department: 'Vận hành',
    dueDate: '2026-06-01',
    daysLeft: 10,
  },
  {
    id: 5,
    fullName: 'Đỗ Thanh Mai',
    position: 'Kế toán tổng hợp',
    department: 'Tài chính - Kế toán',
    dueDate: '2026-06-14',
    daysLeft: 23,
  },
];

export const PENDING_LEAVE: ExpiringRow[] = [
  {
    id: 6,
    fullName: 'Nguyễn Thị Mai',
    position: 'Nhân viên nhân sự',
    department: 'Nhân sự',
    dueDate: '2026-05-26',
    daysLeft: 4,
  },
];

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: 1,
    kind: 'employee',
    titleKey: 'dashboard.activity.employeeAdded',
    titleParams: { name: 'Trần Quang Huy' },
    detailKey: 'dashboard.activity.departmentDetail',
    detailParams: { department: 'Phát triển sản phẩm' },
    at: '2026-05-22T03:30:00.000Z',
  },
  {
    id: 2,
    kind: 'leave',
    titleKey: 'dashboard.activity.leaveRequested',
    titleParams: { name: 'Nguyễn Thị Mai' },
    detailKey: 'dashboard.activity.leaveRange',
    detailParams: { from: '26/05/2026', to: '28/05/2026' },
    at: '2026-05-22T02:15:00.000Z',
  },
  {
    id: 3,
    kind: 'payroll',
    titleKey: 'dashboard.activity.payrollCreated',
    titleParams: { period: '05/2026' },
    detailKey: 'dashboard.activity.payrollTotal',
    detailParams: { total: '3.245.600.000 ₫' },
    at: '2026-05-21T09:45:00.000Z',
  },
  {
    id: 4,
    kind: 'contract',
    titleKey: 'dashboard.activity.contractExpiring',
    titleParams: { name: 'Phạm Văn Nam' },
    detailKey: 'dashboard.activity.dueDetail',
    detailParams: { date: '01/06/2026' },
    at: '2026-05-21T04:20:00.000Z',
  },
];
