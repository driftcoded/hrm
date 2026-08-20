import { useMemo, useState } from 'react';
import { App, Button, DatePicker, Popconfirm, Select, Space, Statistic, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalculatorOutlined,
  CheckOutlined,
  DollarOutlined,
  EditOutlined,
  PrinterOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AdjustSalaryModal } from '@/components/payroll/AdjustSalaryModal';
import { CalculatePayrollModal } from '@/components/payroll/CalculatePayrollModal';
import { PayslipPrintSheet } from '@/components/payroll/PayslipPrintSheet';
import { SalaryStatusTag } from '@/components/payroll/SalaryStatusTag';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useAllDepartments } from '@/hooks/useDepartments';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useBranding } from '@/hooks/useBranding';
import { usePayrollSummary, useSalaries, useSalaryMutations } from '@/hooks/usePayroll';
import { useCanWritePayroll } from '@/hooks/usePermissions';
import { useTableQuery } from '@/hooks/useTableQuery';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import { formatCurrency } from '@/utils/format';
import { SALARY_STATUSES, type Salary, type SalaryStatus } from '@/types/payroll.types';
import styles from './PayrollPage.module.css';

/**
 * `/payroll` — bảng lương của một kỳ (PLAN 6.2).
 *
 * KỲ LUÔN CÓ GIÁ TRỊ, không có lựa chọn "tất cả": bảng lương là số liệu CỦA MỘT
 * THÁNG, và xếp chồng nhiều tháng lên nhau thì cột "thực nhận" không còn cộng
 * lại thành gì có nghĩa.
 *
 * IN PHIẾU LƯƠNG NGAY TỪ DANH SÁCH. Bấm nút in trên một dòng sẽ nạp phiếu của
 * người đó vào vùng in rồi gọi `window.print()`. Không cần mở một trang chi tiết
 * riêng chỉ để bấm thêm một nút nữa — việc thật của kế toán là in lần lượt cả
 * danh sách.
 */
export function PayrollPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();
  const canWrite = useCanWritePayroll();

  const table = useTableQuery({ sort: 'employeeCode', order: 'asc' });
  const { data: branding } = useBranding();

  const now = dayjs();
  const yearParam = Number(table.filters.year);
  const monthParam = Number(table.filters.month);
  const year =
    Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : now.year();
  const month =
    Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.month() + 1;

  const departmentId = table.filters.departmentId
    ? Number(table.filters.departmentId)
    : undefined;
  const status = SALARY_STATUSES.includes(table.filters.status as SalaryStatus)
    ? (table.filters.status as SalaryStatus)
    : undefined;

  const { tree: departmentTree } = useAllDepartments();
  const departments = useMemo(
    () => flattenDepartmentTree(departmentTree),
    [departmentTree],
  );

  const list = useSalaries({
    page: table.page,
    limit: table.pageSize,
    sort: (table.sort as 'employeeCode' | 'netSalary' | 'grossSalary') ?? 'employeeCode',
    order: table.order ?? 'asc',
    year,
    month,
    departmentId,
    status,
  });
  const summary = usePayrollSummary(year, month);
  const mutations = useSalaryMutations();

  const [isCalculateOpen, setCalculateOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<Salary | null>(null);
  /** Phiếu đang nạp vào vùng in — không hiện trên màn hình. */
  const [printing, setPrinting] = useState<Salary | null>(null);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters = departmentId !== undefined || status !== undefined;

  const runTransition = (
    action: () => Promise<unknown>,
    successKey: string,
  ) => {
    void (async () => {
      try {
        await action();
        message.success(t(successKey));
      } catch (error) {
        message.error(resolveError(error));
      }
    })();
  };

  /**
   * In phiếu của một người.
   *
   * `setPrinting` rồi mới `window.print()` trong `setTimeout(0)`: React phải
   * kịp dựng xong phiếu vào DOM trước khi hộp thoại in chụp lại trang, nếu
   * không sẽ in ra một tờ trắng.
   */
  const printPayslip = (salary: Salary) => {
    setPrinting(salary);
    setTimeout(() => window.print(), 0);
  };

  const columns: ColumnsType<Salary> = [
    {
      title: t('payroll.columns.employee'),
      dataIndex: ['employee', 'fullName'],
      sorter: true,
      key: 'employeeCode',
      render: (_: unknown, record) => (
        <div className={styles.person}>
          <span>{record.employee.fullName}</span>
          <span className={styles.personMeta}>
            {record.employee.employeeCode}
            {record.employee.departmentName
              ? ` · ${record.employee.departmentName}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('payroll.columns.workingDays'),
      key: 'days',
      width: 110,
      align: 'right',
      render: (_: unknown, record) => (
        <span className={styles.mono}>
          {record.actualWorkingDays}
          <span className={styles.muted}> / {record.standardWorkingDays}</span>
        </span>
      ),
    },
    {
      title: t('payroll.columns.overtimeHours'),
      dataIndex: 'overtimeHours',
      width: 90,
      align: 'right',
      render: (value: number) => (
        <span className={value > 0 ? styles.mono : styles.muted}>
          {value > 0 ? value : '—'}
        </span>
      ),
    },
    {
      title: t('payroll.columns.gross'),
      dataIndex: 'grossSalary',
      width: 150,
      align: 'right',
      sorter: true,
      key: 'grossSalary',
      render: (value: number) => (
        <span className={styles.mono}>{formatCurrency(value)}</span>
      ),
    },
    {
      title: t('payroll.columns.deduction'),
      key: 'deduction',
      width: 140,
      align: 'right',
      // Gộp bảo hiểm + thuế + tạm ứng + khấu trừ khác: từng khoản có đủ ở phiếu
      // lương, còn ở danh sách thì câu hỏi chỉ là "bị trừ bao nhiêu".
      render: (_: unknown, record) => (
        <span className={styles.mono}>
          {formatCurrency(
            record.totalInsurance +
              record.personalIncomeTax +
              record.advanceDeduction +
              record.otherDeductions,
          )}
        </span>
      ),
    },
    {
      title: t('payroll.columns.net'),
      dataIndex: 'netSalary',
      width: 160,
      align: 'right',
      sorter: true,
      key: 'netSalary',
      render: (value: number) => (
        <strong className={styles.mono}>{formatCurrency(value)}</strong>
      ),
    },
    {
      title: t('payroll.columns.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: SalaryStatus) => <SalaryStatusTag status={value} />,
    },
    {
      title: '',
      key: 'actions',
      width: canWrite ? 190 : 56,
      render: (_: unknown, record) => (
        <Space size={0}>
          <Tooltip title={t('payroll.actions.print')}>
            <Button
              size="small"
              type="text"
              icon={<PrinterOutlined />}
              aria-label={t('payroll.actions.printFor', {
                name: record.employee.fullName,
              })}
              onClick={() => printPayslip(record)}
            />
          </Tooltip>

          {/*
            `calculated` là số nháp: sửa được, duyệt được. Từ `approved` trở đi
            phiếu bị khoá — cùng ranh giới backend đang chặn, để nút không bày
            ra rồi trả về 409.
          */}
          {canWrite && record.status === 'calculated' && (
            <>
              <Tooltip title={t('payroll.actions.adjust')}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={t('payroll.actions.adjust')}
                  onClick={() => setAdjusting(record)}
                />
              </Tooltip>
              <Popconfirm
                title={t('payroll.actions.approveConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() =>
                  runTransition(
                    () => mutations.approveSalary(record.id),
                    'payroll.actions.approveSuccess',
                  )
                }
              >
                <Tooltip title={t('payroll.actions.approve')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<CheckOutlined />}
                    loading={mutations.isApproving}
                    aria-label={t('payroll.actions.approve')}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}

          {canWrite && record.status === 'approved' && (
            <>
              <Popconfirm
                title={t('payroll.actions.payConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() =>
                  runTransition(
                    () => mutations.markSalaryPaid(record.id),
                    'payroll.actions.paySuccess',
                  )
                }
              >
                <Tooltip title={t('payroll.actions.pay')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<DollarOutlined />}
                    loading={mutations.isMarkingPaid}
                    aria-label={t('payroll.actions.pay')}
                  />
                </Tooltip>
              </Popconfirm>

              {/*
                Huỷ là đường thoát duy nhất khi phát hiện sai sau khi đã duyệt,
                nên nó dùng `modal.confirm` chứ không phải `Popconfirm`: câu hỏi
                phải nói ra hậu quả, không chỉ "Chắc chưa?".
              */}
              <Tooltip title={t('payroll.actions.cancel')}>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<StopOutlined />}
                  aria-label={t('payroll.actions.cancel')}
                  onClick={() =>
                    modal.confirm({
                      title: t('payroll.actions.cancelConfirmTitle'),
                      content: t('payroll.actions.cancelConfirmDetail'),
                      okText: t('payroll.actions.cancel'),
                      okButtonProps: { danger: true },
                      cancelText: t('common.cancel'),
                      onOk: () =>
                        mutations
                          .cancelSalary(record.id)
                          .then(() =>
                            message.success(t('payroll.actions.cancelSuccess')),
                          )
                          .catch((error: unknown) =>
                            message.error(resolveError(error)),
                          ),
                    })
                  }
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.summaryRow}>
        <Statistic
          title={t('payroll.summary.headcount')}
          value={summary.data?.headcount ?? 0}
        />
        <Statistic
          title={t('payroll.summary.totalGross')}
          value={formatCurrency(summary.data?.totalGross ?? 0)}
        />
        <Statistic
          title={t('payroll.summary.totalInsurance')}
          value={formatCurrency(summary.data?.totalInsurance ?? 0)}
        />
        <Statistic
          title={t('payroll.summary.totalTax')}
          value={formatCurrency(summary.data?.totalTax ?? 0)}
        />
        <Statistic
          title={t('payroll.summary.totalNet')}
          value={formatCurrency(summary.data?.totalNet ?? 0)}
        />
      </div>

      <div className={styles.filterRow}>
        <DatePicker
          picker="month"
          allowClear={false}
          format="MM/YYYY"
          className={styles.periodPicker}
          value={dayjs().year(year).month(month - 1)}
          onChange={(next: Dayjs | null) => {
            if (next) {
              table.setFilter('year', String(next.year()));
              table.setFilter('month', String(next.month() + 1));
            }
          }}
        />

        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('payroll.filters.department')}
          className={styles.filterSelect}
          value={departmentId}
          onChange={(value?: number) =>
            table.setFilter('departmentId', value ? String(value) : undefined)
          }
          options={departments.map(({ node, depth }) => ({
            value: node.id,
            label: `${'  '.repeat(depth)}${node.name}`,
          }))}
        />

        <Select
          allowClear
          placeholder={t('payroll.filters.status')}
          className={styles.filterSelect}
          value={status}
          onChange={(value?: SalaryStatus) => table.setFilter('status', value)}
          options={SALARY_STATUSES.map((value) => ({
            value,
            label: t(`payroll.status.${value}`),
          }))}
        />

        <Button
          type="link"
          icon={<ReloadOutlined />}
          disabled={!hasFilters}
          onClick={() => {
            table.setFilter('departmentId', undefined);
            table.setFilter('status', undefined);
          }}
        >
          {t('payroll.filters.reset')}
        </Button>

        <span className={styles.spacer} />

        {canWrite && (
          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            onClick={() => setCalculateOpen(true)}
          >
            {t('payroll.calculate.open')}
          </Button>
        )}
      </div>

      <DataTableCard<Salary>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('payroll.loadError')}
        hasFilters={hasFilters}
        total={total}
        // Phân trang dưới bảng đã in "Tổng N bản ghi" rồi.
        showCount={false}
        scrollX={1220}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
        onSorterChange={table.setSorter}
        activeSort={{ key: table.sort, order: table.order }}
      />

      <CalculatePayrollModal
        open={isCalculateOpen}
        onClose={() => setCalculateOpen(false)}
        defaultYear={year}
        defaultMonth={month}
      />

      <AdjustSalaryModal salary={adjusting} onClose={() => setAdjusting(null)} />

      {printing && (
        <PayslipPrintSheet
          salary={printing}
          companyName={branding?.companyName ?? ''}
        />
      )}
    </div>
  );
}
