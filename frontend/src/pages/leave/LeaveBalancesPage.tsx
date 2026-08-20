import { useMemo, useState } from 'react';
import { App, Button, DatePicker, Progress, Select, Space, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AdjustLeaveBalanceModal } from '@/components/leave/AdjustLeaveBalanceModal';
import { InitLeaveBalanceModal } from '@/components/leave/InitLeaveBalanceModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useAllDepartments } from '@/hooks/useDepartments';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveBalanceMutations, useLeaveBalances } from '@/hooks/useLeave';
import { useLeaveTypes } from '@/hooks/useLeaveTypes';
import { useCanWriteLeaveBalance } from '@/hooks/usePermissions';
import { useTableQuery } from '@/hooks/useTableQuery';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import type { LeaveBalance } from '@/types/leave.types';
import styles from './LeaveBalancesPage.module.css';

/**
 * `/leave/balances` — quỹ phép theo năm (PLAN 5.2).
 *
 * NĂM LUÔN CÓ GIÁ TRỊ, không có lựa chọn "tất cả": quỹ phép là một con số CỦA
 * MỘT NĂM, và xếp chồng nhiều năm lên nhau thì cột "còn lại" không còn nghĩa gì.
 *
 * `manager` xem được phòng mình nhưng KHÔNG cấp, KHÔNG sửa — quỹ phép là quyền
 * lợi của người lao động, và đây là lớp kiểm soát duy nhất của việc thay đổi nó.
 */
export function LeaveBalancesPage() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();
  const canWrite = useCanWriteLeaveBalance();
  const mutations = useLeaveBalanceMutations();

  const table = useTableQuery({ sort: 'remainingDays', order: 'asc' });

  const yearParam = Number(table.filters.year);
  const year = Number.isInteger(yearParam) && yearParam > 2000
    ? yearParam
    : dayjs().year();

  const departmentId = table.filters.departmentId
    ? Number(table.filters.departmentId)
    : undefined;
  const leaveTypeId = table.filters.leaveTypeId
    ? Number(table.filters.leaveTypeId)
    : undefined;

  const { tree: departmentTree } = useAllDepartments();
  const departments = useMemo(
    () => flattenDepartmentTree(departmentTree),
    [departmentTree],
  );
  const leaveTypes = useLeaveTypes({ isActive: true });

  const list = useLeaveBalances({
    page: table.page,
    limit: table.pageSize,
    sort: 'remainingDays',
    order: table.order ?? 'asc',
    year,
    departmentId,
    leaveTypeId,
  });

  const [isInitOpen, setInitOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<LeaveBalance | null>(null);

  /**
   * Xoá một dòng quỹ — chỉ dùng cho quỹ CẤP NHẦM.
   *
   * Backend chặn xoá khi đã có ngày bị tiêu, nên câu hỏi ở đây nói thẳng điều
   * kiện đó thay vì để người dùng bấm rồi ăn một lỗi 422.
   */
  const runDelete = (balance: LeaveBalance) => {
    modal.confirm({
      title: t('leave.balances.deleteConfirmTitle'),
      content: t('leave.balances.deleteConfirmDetail'),
      okText: t('leave.balances.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await mutations.deleteBalance(balance.id);
          message.success(t('leave.balances.deleteSuccess'));
        } catch (deleteError) {
          message.error(resolveError(deleteError));
        }
      },
    });
  };

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters = departmentId !== undefined || leaveTypeId !== undefined;

  const columns: ColumnsType<LeaveBalance> = [
    {
      title: t('leave.balances.columns.employee'),
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
      title: t('leave.balances.columns.leaveType'),
      dataIndex: ['leaveType', 'name'],
      width: 150,
      render: (_: unknown, record) => record.leaveType?.name ?? '—',
    },
    {
      title: t('leave.balances.columns.allocated'),
      dataIndex: 'allocatedDays',
      width: 100,
      align: 'right',
      render: (value: number) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t('leave.balances.columns.carriedOver'),
      dataIndex: 'carriedOver',
      width: 110,
      align: 'right',
      // 0 ngày chuyển sang là trường hợp thường gặp nhất — hiện gạch ngang cho
      // mắt lướt qua, số chỉ nổi lên khi thực sự có chuyển phép.
      render: (value: number) => (
        <span className={value > 0 ? styles.mono : styles.muted}>
          {value > 0 ? value : '—'}
        </span>
      ),
    },
    {
      title: t('leave.balances.columns.used'),
      dataIndex: 'usedDays',
      width: 100,
      align: 'right',
      render: (value: number) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t('leave.balances.columns.pending'),
      dataIndex: 'pendingDays',
      width: 110,
      align: 'right',
      render: (value: number) => (
        <span className={value > 0 ? styles.mono : styles.muted}>
          {value > 0 ? value : '—'}
        </span>
      ),
    },
    {
      title: t('leave.balances.columns.remaining'),
      dataIndex: 'remainingDays',
      width: 170,
      sorter: true,
      /*
       * Thanh tiến độ đọc theo phần ĐÃ TIÊU, không phải phần còn lại: câu hỏi
       * người xem có là "người này đã dùng bao nhiêu phép rồi". Con số vẫn hiện
       * bằng chữ vì màu thanh không đọc được thành số.
       */
      render: (value: number, record) => {
        const pool = record.allocatedDays + record.carriedOver;
        const consumed = record.usedDays + record.pendingDays;

        return (
          <div className={styles.remaining}>
            <span className={styles.mono}>
              {value}
              <span className={styles.muted}> / {pool}</span>
            </span>
            <Progress
              percent={pool > 0 ? Math.round((consumed / pool) * 100) : 0}
              size="small"
              showInfo={false}
              status={value <= 0 ? 'exception' : 'normal'}
            />
          </div>
        );
      },
    },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'actions',
            width: 104,
            render: (_: unknown, record: LeaveBalance) => (
              <Space size={0}>
                <Tooltip title={t('leave.balances.adjust')}>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    aria-label={t('leave.balances.adjustFor', {
                      name: record.employee?.fullName ?? '',
                    })}
                    onClick={() => setAdjusting(record)}
                  />
                </Tooltip>

                {/*
                  Chỉ mở nút xoá khi dòng quỹ CHƯA bị tiêu ngày nào — cùng điều
                  kiện backend đang chặn, để nút không bày ra rồi trả về 422.
                */}
                <Tooltip title={t('leave.balances.delete')}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('leave.balances.deleteFor', {
                      name: record.employee?.fullName ?? '',
                    })}
                    disabled={record.usedDays > 0 || record.pendingDays > 0}
                    loading={mutations.isDeleting}
                    onClick={() => runDelete(record)}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.filterRow}>
        <DatePicker
          picker="year"
          allowClear={false}
          format="YYYY"
          className={styles.yearPicker}
          value={dayjs().year(year)}
          onChange={(next: Dayjs | null) => {
            if (next) {
              table.setFilter('year', String(next.year()));
            }
          }}
        />

        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('leave.balances.filters.department')}
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
          placeholder={t('leave.balances.filters.leaveType')}
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

        <Button
          type="link"
          icon={<ReloadOutlined />}
          disabled={!hasFilters}
          onClick={() => {
            table.setFilter('departmentId', undefined);
            table.setFilter('leaveTypeId', undefined);
          }}
        >
          {t('leave.balances.filters.reset')}
        </Button>

        <span className={styles.spacer} />

        {canWrite && (
          <Space size="small">
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setInitOpen(true)}
            >
              {t('leave.balances.init')}
            </Button>
          </Space>
        )}
      </div>

      <DataTableCard<LeaveBalance>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('leave.balances.loadError')}
        hasFilters={hasFilters}
        total={total}
        // Phân trang dưới bảng đã in "Tổng N bản ghi" rồi.
        showCount={false}
        scrollX={1100}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
        onSorterChange={table.setSorter}
        activeSort={{ key: table.sort, order: table.order }}
      />

      <InitLeaveBalanceModal
        open={isInitOpen}
        onClose={() => setInitOpen(false)}
        defaultYear={year}
      />

      <AdjustLeaveBalanceModal
        balance={adjusting}
        onClose={() => setAdjusting(null)}
      />
    </div>
  );
}
