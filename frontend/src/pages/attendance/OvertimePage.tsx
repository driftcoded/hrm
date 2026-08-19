import { useState } from 'react';
import { App, Button, Popconfirm, Select, Space, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { OvertimeStatusTag } from '@/components/attendance/OvertimeStatusTag';
import { OvertimeFormModal } from '@/components/attendance/OvertimeFormModal';
import { RejectOvertimeModal } from '@/components/attendance/RejectOvertimeModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAuthStore } from '@/store/authStore';
import { useOvertimeMutations, useOvertimeRequests } from '@/hooks/useAttendances';
import {
  useCanApproveOvertime,
  useCanRecordOvertime,
} from '@/hooks/usePermissions';
import { useTableQuery } from '@/hooks/useTableQuery';
import {
  OVERTIME_STATUSES,
  type OvertimeRequest,
  type OvertimeStatus,
} from '@/types/attendance.types';
import styles from './OvertimePage.module.css';

/**
 * `/attendance/overtime` — ghi nhận và duyệt giờ làm thêm (PLAN 4.2).
 *
 * KHÔNG PHẢI MÀN TỰ ĐĂNG KÝ. Nhân viên không đăng nhập hệ thống này; thoả
 * thuận làm thêm giờ diễn ra bên ngoài, còn ở đây là:
 *
 *   - QUẢN LÝ ghi nhận cho nhân viên phòng mình (nhân sự ghi cho bất kỳ ai)
 *   - KẾ TOÁN / NHÂN SỰ duyệt trước khi tính lương
 *
 * MỘT MÀN HÌNH, HAI VAI TRÒ, KHÔNG PHẢI HAI TRANG. Cùng một danh sách, nút
 * Duyệt/Từ chối chỉ hiện với người có quyền duyệt. Tách thành hai trang sẽ buộc
 * nhân sự — vốn vừa ghi nhận vừa duyệt — phải nhớ hai địa chỉ cho cùng một loại
 * giấy tờ.
 *
 * Phạm vi dữ liệu do BACKEND quyết định (`resolveScope`): trưởng phòng chỉ thấy
 * đơn của phòng mình dù gửi `?employeeId=` của ai.
 *
 * CỘT "NGƯỜI GHI" LUÔN HIỆN. Backend chặn người vừa ghi vừa duyệt chính đơn đó
 * (`CANNOT_APPROVE_OWN_RECORD`); thấy tên người ghi ngay trên dòng thì người
 * duyệt biết trước vì sao nút của mình sẽ không dùng được.
 */
export function OvertimePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canApprove = useCanApproveOvertime();
  const canRecord = useCanRecordOvertime();
  const myEmployeeId = useAuthStore((state) => state.user?.employee?.id ?? null);

  const table = useTableQuery({ sort: 'workDate', order: 'desc' });
  const status = OVERTIME_STATUSES.includes(table.filters.status as OvertimeStatus)
    ? (table.filters.status as OvertimeStatus)
    : undefined;

  const list = useOvertimeRequests({
    page: table.page,
    limit: table.pageSize,
    sort: 'workDate',
    order: table.order ?? 'desc',
    status,
  });

  const mutations = useOvertimeMutations();
  const [isFormOpen, setFormOpen] = useState(false);
  const [rejecting, setRejecting] = useState<OvertimeRequest | null>(null);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;

  const runApprove = (request: OvertimeRequest) => {
    void (async () => {
      try {
        await mutations.approveOvertime(request.id);
        message.success(t('attendance.overtime.approveSuccess'));
      } catch (approveError) {
        message.error(resolveError(approveError));
      }
    })();
  };

  const runCancel = (request: OvertimeRequest) => {
    void (async () => {
      try {
        await mutations.cancelOvertime(request.id);
        message.success(t('attendance.overtime.cancelSuccess'));
      } catch (cancelError) {
        message.error(resolveError(cancelError));
      }
    })();
  };

  const columns: ColumnsType<OvertimeRequest> = [
    {
      title: t('attendance.overtime.columns.employee'),
      dataIndex: ['employee', 'fullName'],
      render: (_: unknown, record) => (
        <div className={styles.person}>
          <span>{record.employee?.fullName ?? '—'}</span>
          <span className={styles.personMeta}>
            {record.employee?.employeeCode ?? ''}
            {record.employee?.departmentName ? ` · ${record.employee.departmentName}` : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('attendance.overtime.columns.workDate'),
      dataIndex: 'workDate',
      width: 120,
      sorter: true,
      render: (value: string) => (
        <span className={styles.mono}>{dayjs(value).format('DD/MM/YYYY')}</span>
      ),
    },
    {
      title: t('attendance.overtime.columns.span'),
      key: 'span',
      width: 130,
      render: (_: unknown, record) => (
        <span className={styles.mono}>
          {record.startTime} – {record.endTime}
        </span>
      ),
    },
    {
      title: t('attendance.overtime.columns.totalHours'),
      dataIndex: 'totalHours',
      width: 90,
      align: 'right',
      render: (value: number) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t('attendance.overtime.columns.rate'),
      key: 'rate',
      width: 150,
      /*
       * Hệ số và loại ngày đi CÙNG NHAU: "2×" một mình không nói được vì sao,
       * còn "Cuối tuần" một mình không nói được trả bao nhiêu. Phụ trội ca đêm
       * là một khoản CỘNG THÊM cho riêng phần giờ đêm nên hiện thành nhãn
       * riêng, không cộng gộp vào hệ số nền.
       */
      render: (_: unknown, record) => (
        <Space size={4} wrap>
          <Tag bordered={false}>{t(`attendance.overtime.rateType.${record.rateType}`)}</Tag>
          <span className={styles.mono}>{record.rate}×</span>
          {record.nightHours > 0 && (
            <Tooltip
              title={t('attendance.overtime.nightHint', {
                hours: record.nightHours,
                surcharge: record.nightRateSurcharge,
              })}
            >
              <Tag color="purple" bordered={false}>
                {t('attendance.overtime.night')}
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('attendance.overtime.columns.recordedBy'),
      dataIndex: 'recorderName',
      width: 150,
      // Đơn cũ (trước khi có cột `recorded_by`) không biết ai nhập — hiện gạch
      // ngang chứ không đoán.
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('attendance.overtime.columns.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: OvertimeStatus, record) =>
        value === 'rejected' && record.rejectedReason ? (
          <Tooltip title={record.rejectedReason}>
            <span>
              <OvertimeStatusTag status={value} />
            </span>
          </Tooltip>
        ) : (
          <OvertimeStatusTag status={value} />
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

        // Người GHI rút lại đơn mình nhập; nhân sự rút được đơn của người khác.
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
                  onClick={() => runApprove(record)}
                >
                  {t('attendance.overtime.approve')}
                </Button>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejecting(record)}
                >
                  {t('attendance.overtime.reject')}
                </Button>
              </>
            )}
            {!canApprove && isMyRecord && (
              <Popconfirm
                title={t('attendance.overtime.cancelConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() => runCancel(record)}
              >
                <Button size="small" type="text" danger loading={mutations.isCancelling}>
                  {t('attendance.overtime.cancel')}
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
          placeholder={t('attendance.overtime.filters.status')}
          className={styles.filterSelect}
          value={status}
          onChange={(value?: OvertimeStatus) => table.setFilter('status', value)}
          options={OVERTIME_STATUSES.map((value) => ({
            value,
            label: t(`attendance.overtime.status.${value}`),
          }))}
        />

        {canApprove && (
          <Button
            type="link"
            onClick={() => table.setFilter('status', 'pending')}
            disabled={status === 'pending'}
          >
            {t('attendance.overtime.filters.pendingShortcut')}
          </Button>
        )}

        <span className={styles.spacer} />

        {canRecord && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
            {t('attendance.overtime.create')}
          </Button>
        )}
      </div>

      <DataTableCard<OvertimeRequest>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('attendance.overtime.loadError')}
        hasFilters={status !== undefined}
        total={total}
        scrollX={1150}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
        onSorterChange={table.setSorter}
        activeSort={{ key: table.sort, order: table.order }}
      />

      <OvertimeFormModal open={isFormOpen} onClose={() => setFormOpen(false)} />

      <RejectOvertimeModal request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}
