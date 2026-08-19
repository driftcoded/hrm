import { useMemo, useState } from 'react';
import { App, Button, DatePicker, Popconfirm, Select, Space, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { LeaveRequestFormModal } from '@/components/leave/LeaveRequestFormModal';
import { LeaveStatusTag } from '@/components/leave/LeaveStatusTag';
import { RejectLeaveModal } from '@/components/leave/RejectLeaveModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useAllDepartments } from '@/hooks/useDepartments';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveRequestMutations, useLeaveRequests } from '@/hooks/useLeave';
import { useLeaveTypes } from '@/hooks/useLeaveTypes';
import {
  useCanApproveLeave,
  useCanRecordLeave,
} from '@/hooks/usePermissions';
import { useTableQuery } from '@/hooks/useTableQuery';
import { useAuthStore } from '@/store/authStore';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import { LEAVE_STATUSES, type LeaveRequest, type LeaveStatus } from '@/types/leave.types';
import styles from './LeaveRequestsPage.module.css';

/**
 * `/leave` — danh sách đơn nghỉ phép, ghi nhận và duyệt (PLAN 5.2).
 *
 * KHÔNG PHẢI "ĐƠN CỦA TÔI". Nhân viên không đăng nhập hệ thống này; đây là danh
 * sách đơn của người khác, do quản lý ghi nhận và nhân sự duyệt.
 *
 * MỘT MÀN HÌNH, HAI VAI TRÒ. Cùng một bảng; nút Duyệt/Từ chối chỉ hiện với người
 * có quyền duyệt. Tách thành hai trang sẽ buộc nhân sự — vốn vừa ghi nhận vừa
 * duyệt — phải nhớ hai địa chỉ cho cùng một loại giấy tờ.
 *
 * CỘT "NGƯỜI GHI" LUÔN HIỆN: backend chặn người vừa ghi vừa duyệt chính đơn đó
 * (`CANNOT_APPROVE_OWN_RECORD`), nên thấy tên người ghi ngay trên dòng thì người
 * duyệt biết trước vì sao nút của mình sẽ không dùng được.
 */
export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canRecord = useCanRecordLeave();
  const canApprove = useCanApproveLeave();
  const myEmployeeId = useAuthStore((state) => state.user?.employee?.id ?? null);

  const table = useTableQuery({ sort: 'startDate', order: 'desc' });

  const status = LEAVE_STATUSES.includes(table.filters.status as LeaveStatus)
    ? (table.filters.status as LeaveStatus)
    : undefined;
  const departmentId = table.filters.departmentId
    ? Number(table.filters.departmentId)
    : undefined;
  const leaveTypeId = table.filters.leaveTypeId
    ? Number(table.filters.leaveTypeId)
    : undefined;
  const from = table.filters.from;
  const to = table.filters.to;

  const { tree: departmentTree } = useAllDepartments();
  const departments = useMemo(
    () => flattenDepartmentTree(departmentTree),
    [departmentTree],
  );
  const leaveTypes = useLeaveTypes({ isActive: true });

  const list = useLeaveRequests({
    page: table.page,
    limit: table.pageSize,
    sort: 'startDate',
    order: table.order ?? 'desc',
    status,
    departmentId,
    leaveTypeId,
    from,
    to,
  });

  const mutations = useLeaveRequestMutations();
  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters =
    status !== undefined ||
    departmentId !== undefined ||
    leaveTypeId !== undefined ||
    Boolean(from);

  /**
   * Duyệt xong, những ngày ĐÃ CÓ dữ liệu chấm công không bị ghi đè. Đó là thông
   * tin người duyệt phải đọc chứ không phải một toast biến mất sau 3 giây — nên
   * dùng `modal.warning`, còn trường hợp trơn tru thì vẫn là toast.
   */
  const runApprove = (request: LeaveRequest) => {
    void (async () => {
      try {
        const result = await mutations.approveRequest(request.id);

        if (result.attendanceConflicts.length > 0) {
          modal.warning({
            title: t('leave.requests.approveConflictTitle', {
              count: result.attendanceConflicts.length,
            }),
            content: t('leave.requests.approveConflictDetail', {
              dates: result.attendanceConflicts
                .map((date) => dayjs(date).format('DD/MM'))
                .join(', '),
            }),
          });
          return;
        }

        message.success(
          t('leave.requests.approveSuccess', { days: result.attendanceDaysWritten }),
        );
      } catch (approveError) {
        message.error(resolveError(approveError));
      }
    })();
  };

  const runCancel = (request: LeaveRequest) => {
    void (async () => {
      try {
        await mutations.cancelRequest(request.id);
        message.success(t('leave.requests.cancelSuccess'));
      } catch (cancelError) {
        message.error(resolveError(cancelError));
      }
    })();
  };

  /**
   * Xoá đơn — hỏi lại TRƯỚC, và câu hỏi nói đúng hậu quả của trạng thái hiện tại.
   *
   * Xoá một đơn đã duyệt hoàn lại ngày phép và gỡ ngày nghỉ khỏi bảng chấm công;
   * một Popconfirm cụt lủn "Chắc chưa?" giấu mất điều đó.
   */
  const runDelete = (request: LeaveRequest) => {
    const content =
      request.status === 'approved'
        ? t('leave.requests.deleteConfirmApproved', { days: request.totalDays })
        : request.status === 'pending'
          ? t('leave.requests.deleteConfirmPending')
          : t('leave.requests.deleteConfirmClosed');

    modal.confirm({
      title: t('leave.requests.deleteConfirmTitle'),
      content,
      okText: t('leave.requests.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const result = await mutations.deleteRequest(request.id);

          // Ngày công giữ lại là dữ liệu người dùng phải biết, không phải một
          // toast biến mất sau ba giây.
          if (result.attendanceDaysKept > 0) {
            modal.warning({
              title: t('leave.requests.deleteKeptTitle', {
                count: result.attendanceDaysKept,
              }),
              content: t('leave.requests.deleteKeptDetail'),
            });
            return;
          }

          message.success(t('leave.requests.deleteSuccess'));
        } catch (deleteError) {
          message.error(resolveError(deleteError));
        }
      },
    });
  };

  const setRange = (range: [Dayjs | null, Dayjs | null] | null) => {
    table.setFilter('from', range?.[0]?.format('YYYY-MM-DD'));
    table.setFilter('to', range?.[1]?.format('YYYY-MM-DD'));
  };

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: t('leave.requests.columns.employee'),
      dataIndex: ['employee', 'fullName'],
      render: (_: unknown, record) => (
        <div className={styles.person}>
          <span>{record.employee?.fullName ?? '—'}</span>
          <span className={styles.personMeta}>
            {record.employee?.employeeCode ?? ''}
            {record.employee?.departmentName
              ? ` · ${record.employee.departmentName}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('leave.requests.columns.leaveType'),
      dataIndex: ['leaveType', 'name'],
      width: 150,
      render: (_: unknown, record) => record.leaveType?.name ?? '—',
    },
    {
      title: t('leave.requests.columns.range'),
      key: 'range',
      width: 175,
      sorter: true,
      render: (_: unknown, record) => (
        <span className={styles.mono}>
          {dayjs(record.startDate).format('DD/MM/YYYY')}
          {record.startDate === record.endDate
            ? ''
            : ` – ${dayjs(record.endDate).format('DD/MM/YYYY')}`}
        </span>
      ),
    },
    {
      title: t('leave.requests.columns.totalDays'),
      dataIndex: 'totalDays',
      width: 90,
      align: 'right',
      render: (value: number) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t('leave.requests.columns.recordedBy'),
      dataIndex: 'recorderName',
      width: 150,
      // Đơn cũ không biết ai nhập — hiện gạch ngang chứ không đoán.
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('leave.requests.columns.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: LeaveStatus, record) =>
        value === 'rejected' && record.rejectedReason ? (
          <Tooltip title={record.rejectedReason}>
            <span>
              <LeaveStatusTag status={value} />
            </span>
          </Tooltip>
        ) : (
          <LeaveStatusTag status={value} />
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 230,
      render: (_: unknown, record) => {
        // Người GHI sửa/xoá đơn mình nhập; nhân sự làm được với đơn của bất kỳ ai.
        const isMyRecord =
          myEmployeeId !== null && record.recordedBy === myEmployeeId;
        const isPending = record.status === 'pending';

        /*
         * Sửa CHỈ khi còn chờ duyệt. Xoá thì mọi trạng thái, nhưng đơn đã qua
         * tay người duyệt thì chỉ nhân sự — cùng ranh giới backend đang chặn,
         * để nút không bày ra rồi trả về 403.
         */
        const canAmend = isPending && (canApprove || isMyRecord);
        const canDelete = isPending ? canAmend : canApprove;

        return (
          <Space size={4}>
            {isPending && canApprove && (
              <>
                <Button
                  size="small"
                  type="text"
                  icon={<CheckOutlined />}
                  loading={mutations.isApproving}
                  onClick={() => runApprove(record)}
                >
                  {t('leave.requests.approve')}
                </Button>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setRejecting(record)}
                >
                  {t('leave.requests.reject')}
                </Button>
              </>
            )}

            {isPending && !canApprove && isMyRecord && (
              <Popconfirm
                title={t('leave.requests.cancelConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() => runCancel(record)}
              >
                <Button size="small" type="text" danger loading={mutations.isCancelling}>
                  {t('leave.requests.cancel')}
                </Button>
              </Popconfirm>
            )}

            {canAmend && (
              <Tooltip title={t('leave.requests.edit')}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={t('leave.requests.edit')}
                  onClick={() => setEditing(record)}
                />
              </Tooltip>
            )}

            {canDelete && (
              <Tooltip title={t('leave.requests.delete')}>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('leave.requests.delete')}
                  loading={mutations.isDeleting}
                  onClick={() => runDelete(record)}
                />
              </Tooltip>
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
          placeholder={t('leave.requests.filters.status')}
          className={styles.filterSelect}
          value={status}
          onChange={(value?: LeaveStatus) => table.setFilter('status', value)}
          options={LEAVE_STATUSES.map((value) => ({
            value,
            label: t(`leave.status.${value}`),
          }))}
        />

        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('leave.requests.filters.department')}
          className={styles.filterSelect}
          value={departmentId}
          onChange={(value?: number) =>
            table.setFilter('departmentId', value ? String(value) : undefined)
          }
          options={departments.map(({ node, depth }) => ({
            value: node.id,
            label: `${'  '.repeat(depth)}${node.name}`,
          }))}
        />

        <Select
          allowClear
          placeholder={t('leave.requests.filters.leaveType')}
          className={styles.filterSelect}
          value={leaveTypeId}
          onChange={(value?: number) =>
            table.setFilter('leaveTypeId', value ? String(value) : undefined)
          }
          options={(leaveTypes.data ?? []).map((type) => ({
            value: type.id,
            label: type.name,
          }))}
        />

        <DatePicker.RangePicker
          format="DD/MM/YYYY"
          className={styles.rangePicker}
          value={from && to ? [dayjs(from), dayjs(to)] : null}
          onChange={setRange}
        />

        <Button
          type="link"
          icon={<ReloadOutlined />}
          disabled={!hasFilters}
          onClick={() => {
            table.setFilter('status', undefined);
            table.setFilter('departmentId', undefined);
            table.setFilter('leaveTypeId', undefined);
            table.setFilter('from', undefined);
            table.setFilter('to', undefined);
          }}
        >
          {t('leave.requests.filters.reset')}
        </Button>

        <span className={styles.spacer} />

        {canApprove && (
          <Button
            type="link"
            disabled={status === 'pending'}
            onClick={() => table.setFilter('status', 'pending')}
          >
            {t('leave.requests.filters.pendingShortcut')}
          </Button>
        )}

        {canRecord && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
            {t('leave.requests.create')}
          </Button>
        )}
      </div>

      <DataTableCard<LeaveRequest>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('leave.requests.loadError')}
        hasFilters={hasFilters}
        total={total}
        scrollX={1210}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
        onSorterChange={table.setSorter}
        activeSort={{ key: table.sort, order: table.order }}
      />

      <LeaveRequestFormModal open={isFormOpen} onClose={() => setFormOpen(false)} />

      <LeaveRequestFormModal
        open={editing !== null}
        request={editing}
        onClose={() => setEditing(null)}
      />

      <RejectLeaveModal request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}
