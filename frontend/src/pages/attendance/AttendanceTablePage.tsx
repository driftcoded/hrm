import { useMemo, useState } from 'react';
import { App, Button, DatePicker, Select, Space, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { AttendanceStatusTag } from '@/components/attendance/AttendanceStatusTag';
import { AddAttendanceModal } from '@/components/attendance/AddAttendanceModal';
import { AdjustAttendanceModal } from '@/components/attendance/AdjustAttendanceModal';
import { ImportAttendanceModal } from '@/components/attendance/ImportAttendanceModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { useAllDepartments } from '@/hooks/useDepartments';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useAttendances,
  useExportAttendances,
} from '@/hooks/useAttendances';
import {
  useCanExportAttendance,
  useCanWriteAttendance,
} from '@/hooks/usePermissions';
import { useTableQuery } from '@/hooks/useTableQuery';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import {
  ATTENDANCE_STATUSES,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/types/attendance.types';
import styles from './AttendanceTablePage.module.css';

/**
 * Bảng chấm công toàn công ty — màn hình CHÍNH của module (PLAN 4.2).
 *
 * DỮ LIỆU VÀO BẰNG HAI ĐƯỜNG, cả hai đều nằm trên thanh công cụ của màn này:
 * nạp file Excel xuất từ nền tảng chấm công bên ngoài (đường chính, cả tháng),
 * và nhập tay từng dòng cho những ca lẻ file không có. Hệ thống KHÔNG có chức
 * năng tự chấm công.
 *
 * THÁNG LUÔN CÓ GIÁ TRỊ, không có lựa chọn "tất cả". Bảng chấm công là tài
 * liệu của MỘT tháng: đọc cả lịch sử cùng lúc không trả lời được câu hỏi nào
 * mà nhân sự thực sự có, và mở màn hình ra là quét cả bảng.
 *
 * `manager` xem được màn này nhưng backend giới hạn trong phòng ban họ quản
 * (`resolveScope`), và họ KHÔNG có nút nhập, sửa hay nạp file — những thao tác
 * đó tạo ra căn cứ trả lương, và đây là lớp kiểm soát duy nhất của việc đó.
 */
export function AttendanceTablePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canWrite = useCanWriteAttendance();
  const canExport = useCanExportAttendance();

  const table = useTableQuery({ sort: 'workDate', order: 'desc' });

  // Tháng mặc định là tháng hiện tại — thứ HR mở màn hình ra để xem.
  const monthParam = Number(table.filters.month);
  const yearParam = Number(table.filters.year);
  const cursor = useMemo<Dayjs>(
    () =>
      Number.isInteger(monthParam) && Number.isInteger(yearParam) && monthParam >= 1
        ? dayjs(`${yearParam}-${`${monthParam}`.padStart(2, '0')}-01`)
        : dayjs(),
    [monthParam, yearParam],
  );

  const month = cursor.month() + 1;
  const year = cursor.year();

  const departmentId = table.filters.departmentId
    ? Number(table.filters.departmentId)
    : undefined;
  const status = ATTENDANCE_STATUSES.includes(
    table.filters.status as AttendanceStatus,
  )
    ? (table.filters.status as AttendanceStatus)
    : undefined;

  const { tree: departmentTree } = useAllDepartments();
  const departments = useMemo(
    () => flattenDepartmentTree(departmentTree),
    [departmentTree],
  );

  const list = useAttendances({
    page: table.page,
    limit: table.pageSize,
    sort: 'workDate',
    order: table.order ?? 'desc',
    month,
    year,
    departmentId,
    status,
  });

  const { exportAttendances, isExporting } = useExportAttendances();

  const [adjusting, setAdjusting] = useState<AttendanceRecord | null>(null);
  const [isImportOpen, setImportOpen] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters = departmentId !== undefined || status !== undefined;

  const setMonth = (next: Dayjs | null) => {
    if (!next) {
      return;
    }
    table.setFilter('month', String(next.month() + 1));
    table.setFilter('year', String(next.year()));
  };

  const handleExport = () => {
    void (async () => {
      try {
        await exportAttendances({ month, year, departmentId });
        message.success(t('attendance.export.success'));
      } catch (exportError) {
        message.error(resolveError(exportError));
      }
    })();
  };

  const columns: ColumnsType<AttendanceRecord> = [
    {
      title: t('attendance.columns.employee'),
      dataIndex: ['employee', 'fullName'],
      render: (_: unknown, record) => (
        <div className={styles.person}>
          <span className={styles.personName}>{record.employee?.fullName ?? '—'}</span>
          <span className={styles.personMeta}>
            {record.employee?.employeeCode ?? ''}
            {record.employee?.departmentName ? ` · ${record.employee.departmentName}` : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('attendance.columns.workDate'),
      dataIndex: 'workDate',
      width: 120,
      sorter: true,
      render: (value: string) => (
        <span className={styles.mono}>{dayjs(value).format('DD/MM/YYYY')}</span>
      ),
    },
    {
      title: t('attendance.columns.checkIn'),
      dataIndex: 'checkIn',
      width: 96,
      render: (value: string | null) => <span className={styles.mono}>{value ?? '—'}</span>,
    },
    {
      title: t('attendance.columns.checkOut'),
      dataIndex: 'checkOut',
      width: 96,
      render: (value: string | null) => <span className={styles.mono}>{value ?? '—'}</span>,
    },
    {
      title: t('attendance.columns.break'),
      key: 'break',
      width: 110,
      /*
       * Không có giờ nghỉ trên bản ghi thì giờ công đã tính theo khung nghỉ
       * chuẩn — nói ra để người đọc bảng không tưởng là ngày đó không nghỉ.
       */
      render: (_: unknown, record) =>
        record.breakStart && record.breakEnd ? (
          <span className={styles.mono}>
            {record.breakStart}–{record.breakEnd}
          </span>
        ) : (
          <span className={styles.muted}>{t('attendance.columns.breakStandard')}</span>
        ),
    },
    {
      title: t('attendance.columns.workHours'),
      dataIndex: 'workHours',
      width: 100,
      align: 'right',
      // `null` (chưa chấm ra) hiện gạch ngang, KHÔNG hiện 0 — 0 giờ công là một
      // sự thật khác hẳn với "chưa biết".
      render: (value: number | null) => (
        <span className={styles.mono}>{value ?? '—'}</span>
      ),
    },
    {
      title: t('attendance.columns.overtimeHours'),
      dataIndex: 'overtimeHours',
      width: 130,
      align: 'right',
      render: (value: number) => (
        <span className={styles.mono}>{value > 0 ? value : '—'}</span>
      ),
    },
    {
      title: t('attendance.columns.status'),
      dataIndex: 'status',
      width: 130,
      render: (value: AttendanceStatus) => <AttendanceStatusTag status={value} />,
    },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'actions',
            width: 56,
            /*
             * Nút sửa đơn lẻ chứ không dùng `RowActions`: component đó luôn kèm
             * một hành động XOÁ, mà một ngày công thì không xoá được — nó chỉ
             * được điều chỉnh, có ghi lý do.
             */
            render: (_: unknown, record: AttendanceRecord) => (
              <Button
                type="text"
                icon={<EditOutlined />}
                aria-label={t('attendance.actions.adjustFor', {
                  name: record.employee?.fullName ?? '',
                  date: dayjs(record.workDate).format('DD/MM/YYYY'),
                })}
                onClick={() => setAdjusting(record)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      {/* Thanh lọc nằm thẳng trên nền trang, không bọc card — nó là dải điều
          khiển của bảng ngay bên dưới. */}
      <div className={styles.filterRow}>
        <DatePicker
          picker="month"
          allowClear={false}
          value={cursor}
          format="MM/YYYY"
          onChange={setMonth}
          className={styles.monthPicker}
        />

        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('attendance.filters.department')}
          className={styles.filterSelect}
          value={departmentId}
          onChange={(value?: number) =>
            table.setFilter('departmentId', value ? String(value) : undefined)
          }
          // Thụt lề theo `depth` để cây phòng ban vẫn đọc được khi bị dàn phẳng.
          options={departments.map(({ node, depth }) => ({
            value: node.id,
            label: `${'  '.repeat(depth)}${node.name}`,
          }))}
        />

        <Select
          allowClear
          placeholder={t('attendance.filters.status')}
          className={styles.filterSelect}
          value={status}
          onChange={(value?: AttendanceStatus) => table.setFilter('status', value)}
          options={ATTENDANCE_STATUSES.map((value) => ({
            value,
            label: t(`attendance.status.${value}`),
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
          {t('attendance.filters.reset')}
        </Button>

        <span className={styles.spacer} />

        <Space size="small">
          {canWrite && (
            <>
              {/* Nạp Excel đứng TRƯỚC và là nút chính: nó là đường đưa dữ liệu
                  vào thường dùng, còn nhập tay chỉ cho những ca lẻ. */}
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={() => setImportOpen(true)}
              >
                {t('attendance.import.open')}
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
                {t('attendance.add.open')}
              </Button>
            </>
          )}
          {canExport && (
            <Tooltip title={t('attendance.export.hint', { count: total })}>
              <Button
                icon={<ExportOutlined />}
                loading={isExporting}
                onClick={handleExport}
              >
                {t('attendance.export.action')}
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      <DataTableCard<AttendanceRecord>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('attendance.loadError')}
        hasFilters={hasFilters}
        total={total}
        scrollX={1120}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
        onSorterChange={table.setSorter}
        activeSort={{ key: table.sort, order: table.order }}
      />

      <AddAttendanceModal
        open={isAddOpen}
        onClose={() => setAddOpen(false)}
        defaultDate={cursor}
      />

      <AdjustAttendanceModal
        record={adjusting}
        onClose={() => setAdjusting(null)}
      />

      <ImportAttendanceModal
        open={isImportOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}
