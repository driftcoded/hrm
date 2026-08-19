import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type {
  CalculatePayrollPayload,
  CreateSalaryAdvancePayload,
  PayrollPeriod,
  PayrollPeriodSummary,
  PayrollRunResult,
  PayrollSettings,
  Salary,
  SalaryAdvance,
  SalaryAdvanceFilters,
  SalaryFilters,
  UpdatePayrollSettingsPayload,
  UpdateSalaryPayload,
} from '@/types/payroll.types';

/**
 * Mọi call của phân hệ Lương — nơi DUY NHẤT gọi `/salaries`,
 * `/salary-advances` và `/payroll-settings` (frontend/CLAUDE.md folder rule).
 *
 * KHÔNG CÓ ENDPOINT "LƯƠNG CỦA TÔI". Nhân viên không đăng nhập hệ thống này;
 * phiếu lương cá nhân do nhân sự in ra từ màn hình chi tiết.
 */

function toQuery(filters?: object): Record<string, string> | undefined {
  if (!filters) {
    return undefined;
  }

  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params[key] = String(value);
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

async function get<T>(url: string, filters?: object): Promise<T> {
  const { data } = await apiClient.get<ApiSuccessResponse<T>>(url, {
    params: toQuery(filters),
  });
  return data.data;
}

// ------------------------------------------------------------ bảng lương ----

export function listSalaries(
  filters: SalaryFilters,
): Promise<PaginatedData<Salary>> {
  return get<PaginatedData<Salary>>('/salaries', filters);
}

export function getSalary(id: number): Promise<Salary> {
  return get<Salary>(`/salaries/${id}`);
}

export function getPayrollSummary(
  year: number,
  month: number,
): Promise<PayrollPeriodSummary> {
  return get<PayrollPeriodSummary>('/salaries/summary', { year, month });
}

/** Các kỳ ĐÃ CÓ dữ liệu — để không cho chọn một tháng chắc chắn rỗng. */
export function listPayrollPeriods(): Promise<PayrollPeriod[]> {
  return get<PayrollPeriod[]>('/salaries/periods');
}

/**
 * Tính lương cho cả kỳ.
 *
 * `dryRun` là bước xem trước: backend trả về đúng số sẽ tạo, ghi đè và bỏ qua mà
 * không ghi gì. Đây là thao tác chạm vào cả công ty một lần và không có nút hoàn
 * tác, nên màn hình luôn gọi bước này trước.
 */
export async function calculatePayroll(
  payload: CalculatePayrollPayload,
): Promise<PayrollRunResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<PayrollRunResult>>(
    '/salaries/calculate',
    payload,
  );
  return data.data;
}

export async function updateSalary(
  id: number,
  payload: UpdateSalaryPayload,
): Promise<Salary> {
  const { data } = await apiClient.patch<ApiSuccessResponse<Salary>>(
    `/salaries/${id}`,
    payload,
  );
  return data.data;
}

async function transition(id: number, action: string): Promise<Salary> {
  const { data } = await apiClient.patch<ApiSuccessResponse<Salary>>(
    `/salaries/${id}/${action}`,
    {},
  );
  return data.data;
}

export function approveSalary(id: number): Promise<Salary> {
  return transition(id, 'approve');
}

export function markSalaryPaid(id: number): Promise<Salary> {
  return transition(id, 'mark-paid');
}

export function cancelSalary(id: number): Promise<Salary> {
  return transition(id, 'cancel');
}

// --------------------------------------------------------- tạm ứng lương ----

export function listSalaryAdvances(
  filters?: SalaryAdvanceFilters,
): Promise<PaginatedData<SalaryAdvance>> {
  return get<PaginatedData<SalaryAdvance>>('/salary-advances', filters);
}

export async function createSalaryAdvance(
  payload: CreateSalaryAdvancePayload,
): Promise<SalaryAdvance> {
  const { data } = await apiClient.post<ApiSuccessResponse<SalaryAdvance>>(
    '/salary-advances',
    payload,
  );
  return data.data;
}

async function advanceTransition(
  id: number,
  action: string,
  body: object = {},
): Promise<SalaryAdvance> {
  const { data } = await apiClient.patch<ApiSuccessResponse<SalaryAdvance>>(
    `/salary-advances/${id}/${action}`,
    body,
  );
  return data.data;
}

export function approveSalaryAdvance(id: number): Promise<SalaryAdvance> {
  return advanceTransition(id, 'approve');
}

export function rejectSalaryAdvance(
  id: number,
  reason: string,
): Promise<SalaryAdvance> {
  return advanceTransition(id, 'reject', { reason });
}

export function cancelSalaryAdvance(id: number): Promise<SalaryAdvance> {
  return advanceTransition(id, 'cancel');
}

// -------------------------------------------------------- cấu hình lương ----

export function getPayrollSettings(): Promise<PayrollSettings> {
  return get<PayrollSettings>('/payroll-settings');
}

export async function updatePayrollSettings(
  payload: UpdatePayrollSettingsPayload,
): Promise<PayrollSettings> {
  const { data } = await apiClient.patch<ApiSuccessResponse<PayrollSettings>>(
    '/payroll-settings',
    payload,
  );
  return data.data;
}
