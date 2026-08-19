import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveSalary,
  approveSalaryAdvance,
  calculatePayroll,
  cancelSalary,
  cancelSalaryAdvance,
  createSalaryAdvance,
  getPayrollSettings,
  getPayrollSummary,
  getSalary,
  listPayrollPeriods,
  listSalaries,
  listSalaryAdvances,
  markSalaryPaid,
  rejectSalaryAdvance,
  updatePayrollSettings,
  updateSalary,
} from '@/services/payroll.service';
import type {
  CalculatePayrollPayload,
  CreateSalaryAdvancePayload,
  SalaryAdvanceFilters,
  SalaryFilters,
  UpdatePayrollSettingsPayload,
  UpdateSalaryPayload,
} from '@/types/payroll.types';

/**
 * Query key của phân hệ Lương.
 *
 * `root` để mọi thay đổi làm mới TẤT CẢ màn hình cùng lúc: duyệt một phiếu vừa
 * đổi danh sách, vừa đổi thẻ tổng của kỳ. Để hai cái đó lệch nhau là để người
 * dùng thấy hai sự thật cùng lúc.
 *
 * Tạm ứng nằm CHUNG gốc với bảng lương, không tách: duyệt một phiếu tạm ứng sẽ
 * đổi số tiền bị trừ ở lần tính lương sau, nên hai màn hình không độc lập.
 */
export const PAYROLL_KEYS = {
  root: ['payroll'] as const,
  salaries: (filters: SalaryFilters) => ['payroll', 'salaries', filters] as const,
  salary: (id: number) => ['payroll', 'salary', id] as const,
  summary: (year: number, month: number) =>
    ['payroll', 'summary', year, month] as const,
  periods: () => ['payroll', 'periods'] as const,
  advances: (filters?: SalaryAdvanceFilters) =>
    ['payroll', 'advances', filters] as const,
  settings: () => ['payroll', 'settings'] as const,
};

export function useSalaries(filters: SalaryFilters) {
  return useQuery({
    queryKey: PAYROLL_KEYS.salaries(filters),
    queryFn: () => listSalaries(filters),
  });
}

export function useSalary(id: number | null) {
  return useQuery({
    queryKey: PAYROLL_KEYS.salary(id ?? 0),
    queryFn: () => getSalary(id as number),
    enabled: id !== null,
  });
}

export function usePayrollSummary(year: number, month: number) {
  return useQuery({
    queryKey: PAYROLL_KEYS.summary(year, month),
    queryFn: () => getPayrollSummary(year, month),
  });
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: PAYROLL_KEYS.periods(),
    queryFn: () => listPayrollPeriods(),
  });
}

export function useSalaryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: PAYROLL_KEYS.root });
  };

  /*
   * `calculate` KHÔNG làm mới cache khi chạy thử: bước xem trước không ghi gì,
   * nên kéo lại toàn bộ danh sách chỉ để hiện đúng bộ số cũ là lãng phí.
   */
  const calculate = useMutation({
    mutationFn: (payload: CalculatePayrollPayload) => calculatePayroll(payload),
    onSuccess: (_result, payload) => {
      if (!payload.dryRun) {
        invalidate();
      }
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSalaryPayload }) =>
      updateSalary(id, payload),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: number) => approveSalary(id),
    onSuccess: invalidate,
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => markSalaryPaid(id),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelSalary(id),
    onSuccess: invalidate,
  });

  return {
    calculatePayroll: calculate.mutateAsync,
    updateSalary: update.mutateAsync,
    approveSalary: approve.mutateAsync,
    markSalaryPaid: markPaid.mutateAsync,
    cancelSalary: cancel.mutateAsync,
    isCalculating: calculate.isPending,
    isUpdating: update.isPending,
    isApproving: approve.isPending,
    isMarkingPaid: markPaid.isPending,
    isCancelling: cancel.isPending,
  };
}

export function useSalaryAdvances(filters?: SalaryAdvanceFilters) {
  return useQuery({
    queryKey: PAYROLL_KEYS.advances(filters),
    queryFn: () => listSalaryAdvances(filters),
  });
}

export function useSalaryAdvanceMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: PAYROLL_KEYS.root });
  };

  const create = useMutation({
    mutationFn: (payload: CreateSalaryAdvancePayload) =>
      createSalaryAdvance(payload),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: number) => approveSalaryAdvance(id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      rejectSalaryAdvance(id, reason),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelSalaryAdvance(id),
    onSuccess: invalidate,
  });

  return {
    createAdvance: create.mutateAsync,
    approveAdvance: approve.mutateAsync,
    rejectAdvance: reject.mutateAsync,
    cancelAdvance: cancel.mutateAsync,
    isCreating: create.isPending,
    isApproving: approve.isPending,
    isRejecting: reject.isPending,
    isCancelling: cancel.isPending,
  };
}

export function usePayrollSettings(enabled = true) {
  return useQuery({
    queryKey: PAYROLL_KEYS.settings(),
    queryFn: () => getPayrollSettings(),
    enabled,
  });
}

export function usePayrollSettingsMutation() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (payload: UpdatePayrollSettingsPayload) =>
      updatePayrollSettings(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PAYROLL_KEYS.root });
    },
  });

  return {
    updateSettings: update.mutateAsync,
    isSaving: update.isPending,
  };
}
