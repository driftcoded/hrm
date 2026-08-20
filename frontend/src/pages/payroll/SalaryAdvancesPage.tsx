import { useState } from 'react';
import { App, Button, DatePicker, Popconfirm, Select, Space, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { RejectAdvanceModal } from '@/components/payroll/RejectAdvanceModal';
import { SalaryAdvanceFormModal } from '@/components/payroll/SalaryAdvanceFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useSalaryAdvanceMutations, useSalaryAdvances } from '@/hooks/usePayroll';
import { useCanApproveAdvance, useCanRecordAdvance } from '@/hooks/usePermissions';
import { useTableQuery } from '@/hooks/useTableQuery';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  SALARY_ADVANCE_STATUSES,
  type SalaryAdvance,
  type SalaryAdvanceStatus,
} from '@/types/payroll.types';
import styles from './SalaryAdvancesPage.module.css';

/**
 * `/payroll/advances` — tạm ứng lương (PLAN 6.2).
 *
 * HAI CỘT NGÀY, KHÔNG PHẢI MỘT. "Ngày ứng" là ngày chi tiền, "Trừ vào kỳ" là kỳ
 * lương bị trừ — ứng ngày 28/07 để trừ vào lương tháng 8 là chuyện bình thường.
 * Gộp thành một cột sẽ khiến kế toán không đối chiếu được với bảng lương.
 *
 * `deducted` KHÔNG CÓ NÚT NÀO. Phiếu đó đã thành một dòng trên bảng lương của ai
 * đó; đổi nó ở đây sẽ làm bảng lương nói khác với chứng từ mà không có gì cảnh
 * báo. Muốn sửa thì huỷ dòng lương rồi tính lại.
 */
export function SalaryAdvancesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canRecord = useCanRecordAdvance();
  const canApprove = useCanApproveAdvance();
  const myEmployeeId = useAuthStore((state) => state.user?.employee?.id ?? null);

  const table = useTableQuery({});

  const status = SALARY_ADVANCE_STATUSES.includes(
    table.filters.status as SalaryAdvanceStatus,
  )
    ? (table.filters.status as SalaryAdvanceStatus)
    : undefined;
  const deductYear = table.filters.deductYear
    ? Number(table.filters.deductYear)
    : undefined;
  const deductMonth = table.filters.deductMonth
    ? Number(table.filters.deductMonth)
    : undefined;

  const list = useSalaryAdvances({
    page: table.page,
    limit: table.pageSize,
    status,
    deductYear,
    deductMonth,
  });
  const mutations = useSalaryAdvanceMutations();

  const [isFormOpen, setFormOpen] = useState(false);
  const [rejecting, setRejecting] = useState<SalaryAdvance | null>(null);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters = status !== undefined || deductYear !== undefined;

  const run = (action: () => Promise<unknown>, successKey: string) => {
    void (async () => {
      try {
        await action();
        message.success(t(successKey));
      } catch (error) {
        message.error(resolveError(error));
      }
    })();
  };

  const columns: ColumnsType<SalaryAdvance> = [
    {
      title: t('payroll.advances.columns.employee'),
      dataIndex: ['employee', 'fullName'],
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
      title: t('payroll.advances.columns.amount'),
      dataIndex: 'amount',
      width: 150,
      align: 'right',
      render: (value: number) => (
        <strong className={styles.mono}>{formatCurrency(value)}</strong>
      ),
    },
    {
      title: t('payroll.advances.columns.outstanding'),
      key: 'outstanding',
      width: 150,
      align: 'right',
      /*
       * Bảng lương KHÔNG trừ quá phần lương còn lại, nên một phiếu có thể mới
       * thu được một phần. Con số còn nợ phải hiện ra — nếu không, kế toán đọc
       * trạng thái "đã duyệt" mà tưởng đã thu xong.
       */
      render: (_: unknown, record) => {
        const outstanding = record.amount - record.deductedAmount;

        if (record.status !== 'approved' && record.status !== 'deducted') {
          return <span className={styles.muted}>—</span>;
        }

        return outstanding > 0 ? (
          <span className={styles.mono}>{formatCurrency(outstanding)}</span>
        ) : (
          <span className={styles.muted}>{t('payroll.advances.settled')}</span>
        );
      },
    },
    {
      title: t('payroll.advances.columns.advanceDate'),
      dataIndex: 'advanceDate',
      width: 120,
      render: (value: string) => (
        <span className={styles.mono}>{formatDate(value)}</span>
      ),
    },
    {
      title: t('payroll.advances.columns.deductPeriod'),
      key: 'deductPeriod',
      width: 120,
      render: (_: unknown, record) => (
        <Tag bordered={false}>
          {t('payroll.periodLabel', {
            month: record.deductMonth,
            year: record.deductYear,
          })}
        </Tag>
      ),
    },
    {
      title: t('payroll.advances.columns.reason'),
      dataIndex: 'reason',
      ellipsis: true,
    },
    {
      title: t('payroll.advances.columns.recordedBy'),
      dataIndex: 'recorderName',
      width: 150,
      // Phiếu cũ không biết ai nhập — hiện gạch ngang chứ không đoán.
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('payroll.advances.columns.status'),
      dataIndex: 'status',
      width: 130,
      render: (value: SalaryAdvanceStatus, record) =>
        value === 'rejected' && record.rejectedReason ? (
          <Tooltip title={record.rejectedReason}>
            <span>
              <AdvanceStatusTag status={value} />
            </span>
          </Tooltip>
        ) : (
          <AdvanceStatusTag status={value} />
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 170,
      render: (_: unknown, record) => {
        if (record.status !== 'pending') {
          return null;
        }

        const isMyRecord =
          myEmployeeId !== null && record.recordedBy === myEmployeeId;

        return (
          <Space size={4}>
            {canApprove && (
              <>
                <Button
                  size="small"
                  type="text"
                  icon={<CheckOutlined />}
                  loading={mutations.isApproving}
                  onClick={() =>
                    run(
                      () => mutations.approveAdvance(record.id),
                      'payroll.advances.approveSuccess',
                    )
                  }
                >
                  {t('payroll.advances.approve')}
                </Button>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejecting(record)}
                >
                  {t('payroll.advances.reject')}
                </Button>
              </>
            )}

            {!canApprove && isMyRecord && (
              <Popconfirm
                title={t('payroll.advances.cancelConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() =>
                  run(
                    () => mutations.cancelAdvance(record.id),
                    'payroll.advances.cancelSuccess',
                  )
                }
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  loading={mutations.isCancelling}
                >
                  {t('payroll.advances.cancel')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.filterRow}>
        <Select
          allowClear
          placeholder={t('payroll.advances.filters.status')}
          className={styles.filterSelect}
          value={status}
          onChange={(value?: SalaryAdvanceStatus) =>
            table.setFilter('status', value)
          }
          options={SALARY_ADVANCE_STATUSES.map((value) => ({
            value,
            label: t(`payroll.advances.status.${value}`),
          }))}
        />

        <DatePicker
          picker="month"
          format="MM/YYYY"
          className={styles.periodPicker}
          placeholder={t('payroll.advances.filters.deductPeriod')}
          value={
            deductYear && deductMonth
              ? dayjs().year(deductYear).month(deductMonth - 1)
              : null
          }
          onChange={(next: Dayjs | null) => {
            table.setFilter('deductYear', next ? String(next.year()) : undefined);
            table.setFilter(
              'deductMonth',
              next ? String(next.month() + 1) : undefined,
            );
          }}
        />

        <Button
          type="link"
          icon={<ReloadOutlined />}
          disabled={!hasFilters}
          onClick={() => {
            table.setFilter('status', undefined);
            table.setFilter('deductYear', undefined);
            table.setFilter('deductMonth', undefined);
          }}
        >
          {t('payroll.filters.reset')}
        </Button>

        <span className={styles.spacer} />

        {canApprove && (
          <Button
            type="link"
            disabled={status === 'pending'}
            onClick={() => table.setFilter('status', 'pending')}
          >
            {t('payroll.advances.filters.pendingShortcut')}
          </Button>
        )}

        {canRecord && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setFormOpen(true)}
          >
            {t('payroll.advances.create')}
          </Button>
        )}
      </div>

      <DataTableCard<SalaryAdvance>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('payroll.advances.loadError')}
        hasFilters={hasFilters}
        total={total}
        // Phân trang dưới bảng đã in "Tổng N bản ghi" rồi.
        showCount={false}
        scrollX={1300}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
      />

      <SalaryAdvanceFormModal
        open={isFormOpen}
        onClose={() => setFormOpen(false)}
      />

      <RejectAdvanceModal
        advance={rejecting}
        onClose={() => setRejecting(null)}
      />
    </div>
  );
}

/**
 * Trạng thái phiếu tạm ứng.
 *
 * `deducted` màu xám chứ không phải xanh: việc đã xong và không còn thao tác nào
 * — nó không cần hút mắt như một phiếu vừa được duyệt và đang chờ chi tiền.
 */
const ADVANCE_COLORS: Record<SalaryAdvanceStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  deducted: 'default',
  cancelled: 'default',
};

function AdvanceStatusTag({ status }: { status: SalaryAdvanceStatus }) {
  const { t } = useTranslation();

  return (
    <Tag color={ADVANCE_COLORS[status]} bordered={false}>
      {t(`payroll.advances.status.${status}`)}
    </Tag>
  );
}
