import { Button, DatePicker, Form, Input, Select, Switch, Tag, type TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { BooleanTag } from '@/components/crud/BooleanTag';
import { CrudFormModal } from '@/components/crud/CrudFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { RowActions } from '@/components/crud/RowActions';
import { TableSearch } from '@/components/crud/TableSearch';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import { useCrudScreen } from '@/hooks/useCrudScreen';
import { useHolidays } from '@/hooks/useHolidays';
import { parseEnumParam, parseIntParam, useTableQuery } from '@/hooks/useTableQuery';
import {
  HOLIDAY_NAME_MAX_LENGTH,
  HOLIDAY_NOTE_MAX_LENGTH,
  HOLIDAY_SORT_KEYS,
  HOLIDAY_TYPES,
  MAX_HOLIDAY_YEAR,
  MIN_HOLIDAY_YEAR,
  type Holiday,
  type HolidayPayload,
  type HolidaySortKey,
  type HolidayType,
} from '@/types/masterData.types';
import { formatDate } from '@/utils/format';
import styles from './settingsPage.module.css';

/**
 * `/settings/holidays` — the paid public-holiday calendar, one row per date.
 *
 * NO "repeats annually" CONTROL, and that is deliberate. PLAN.md §2.2 says
 * "chọn ngày lặp lại hàng năm", but the backend has no recurrence field: the
 * `holidays` table is `(name, holiday_date UNIQUE, type, year, is_paid, note)`
 * and `year` is derived server-side from the date. It could not work anyway —
 * Tết, Giỗ Tổ Hùng Vương and the compensatory days that follow them are lunar,
 * so they land on a different solar date every year (Tết 2025 = 27/01,
 * Tết 2026 = 16/02). Each year is entered as its own set of rows and read back
 * with the `?year=` filter, which is what the year selector above the table does.
 *
 * `holidayDate` is sent as `YYYY-MM-DD` but always displayed `DD/MM/YYYY` via
 * `formatDate` / the DatePicker's `format` (docs/ui-conventions.md §6).
 */

interface HolidayFormValues {
  name: string;
  holidayDate: Dayjs;
  type: HolidayType;
  note?: string;
  isPaid: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  national: 'red',
  company: 'blue',
  other: 'default',
};

export function HolidaysPage() {
  const { t } = useTranslation();
  const canWrite = useCanWriteMasterData();
  const table = useTableQuery({ sort: 'holidayDate', order: 'asc' });
  const [form] = Form.useForm<HolidayFormValues>();

  const search = table.filters.search;
  const rawYear = parseIntParam(table.filters.year);
  // Out-of-range years are dropped rather than sent: the backend 400s on them.
  const year =
    rawYear && rawYear >= MIN_HOLIDAY_YEAR && rawYear <= MAX_HOLIDAY_YEAR ? rawYear : undefined;
  const type = parseEnumParam<HolidayType>(table.filters.type, HOLIDAY_TYPES);
  const hasFilters = Boolean(search) || year !== undefined || type !== undefined;

  // Unknown values are dropped rather than forwarded: `sort` is a strict
  // whitelist on the backend and an unlisted value answers 400.
  const sortKey = parseEnumParam<HolidaySortKey>(table.sort, HOLIDAY_SORT_KEYS) ?? 'holidayDate';
  const sortOrder = table.order ?? 'asc';

  const resource = useHolidays({
    page: table.page,
    limit: table.pageSize,
    sort: sortKey,
    order: sortOrder,
    year,
    type,
    ...(search ? { search } : {}),
  });

  const screen = useCrudScreen<Holiday, HolidayPayload>({
    resource,
    entityName: t('settings.holidays.entity'),
    rowTitle: (row) => `${row.name} (${formatDate(row.holidayDate)})`,
  });

  const rows = resource.data?.items ?? [];
  const total = resource.data?.meta.total ?? 0;

  const typeOptions = HOLIDAY_TYPES.map((value) => ({
    value,
    label: t(`settings.holidays.types.${value}`),
  }));

  const columns: TableProps<Holiday>['columns'] = [
    {
      title: t('settings.holidays.date'),
      dataIndex: 'holidayDate',
      key: 'holidayDate',
      width: 150,
      sorter: true,
      render: (value: string) => <span className={styles.strongCell}>{formatDate(value)}</span>,
    },
    {
      title: t('settings.holidays.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: t('settings.holidays.type'),
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (value: string) => (
        <Tag color={TYPE_COLORS[value] ?? 'default'}>
          {t(`settings.holidays.types.${value}`, { defaultValue: value })}
        </Tag>
      ),
    },
    {
      title: t('settings.holidays.year'),
      dataIndex: 'year',
      key: 'year',
      width: 100,
      align: 'right',
      sorter: true,
    },
    {
      title: t('settings.holidays.isPaid'),
      dataIndex: 'isPaid',
      key: 'isPaid',
      width: 140,
      render: (value: boolean) => (
        <BooleanTag
          value={value}
          trueLabel={t('settings.holidays.paid')}
          falseLabel={t('settings.holidays.unpaid')}
        />
      ),
    },
    {
      title: t('settings.holidays.note'),
      dataIndex: 'note',
      key: 'note',
      width: 260,
      render: (value: string | null) =>
        value ? <span className={styles.clampedText}>{value}</span> : <span className={styles.muted}>—</span>,
    },
  ];

  if (canWrite) {
    columns.push({
      title: t('settings.fields.actions'),
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_value, row) => (
        <RowActions
          canWrite={canWrite}
          recordName={row.name}
          onEdit={() => screen.openEdit(row)}
          onDelete={() => screen.confirmDelete(row)}
          disabled={screen.isDeleting}
        />
      ),
    });
  }

  const addButton = canWrite ? (
    <Button type="primary" icon={<PlusOutlined />} onClick={screen.openCreate}>
      {t('settings.holidays.add')}
    </Button>
  ) : null;

  const initialValues: Partial<HolidayFormValues> = screen.editing
    ? {
        name: screen.editing.name,
        holidayDate: dayjs(screen.editing.holidayDate),
        type: (screen.editing.type as HolidayType) ?? 'national',
        note: screen.editing.note ?? undefined,
        isPaid: screen.editing.isPaid,
      }
    : {
        type: 'national',
        isPaid: true,
        // Pre-fill the year currently being filtered, so adding to the 2027
        // calendar does not start on today's date.
        holidayDate: year ? dayjs().year(year).startOf('year') : undefined,
      };

  const handleSubmit = (values: HolidayFormValues) => {
    void screen.submit({
      name: values.name.trim(),
      // `year` is derived by the backend from this date — never send it.
      holidayDate: values.holidayDate.format('YYYY-MM-DD'),
      type: values.type,
      note: values.note?.trim() ? values.note.trim() : null,
      isPaid: values.isPaid,
    });
  };

  return (
    <>
      <PageHeader
        title={t('nav.holidays')}
        subtitle={t('settings.holidays.subtitle')}
        actions={addButton}
      />

      <DataTableCard<Holiday>
        columns={columns}
        rows={rows}
        isLoading={resource.isLoading}
        isRefreshing={resource.isFetching && !resource.isLoading}
        isError={resource.isError}
        onRetry={resource.refetch}
        errorMessage={t('settings.holidays.loadError')}
        total={total}
        hasFilters={hasFilters}
        emptyAction={addButton}
        scrollX={1200}
        onSorterChange={table.setSorter}
        activeSort={{ key: sortKey, order: sortOrder }}
        filters={
          <>
            <DatePicker
              picker="year"
              className={styles.filterSelect}
              value={year ? dayjs().year(year) : null}
              onChange={(value) => table.setFilter('year', value ? value.year() : undefined)}
              placeholder={t('settings.holidays.allYears')}
              aria-label={t('settings.holidays.year')}
            />
            <Select<string>
              className={styles.filterSelect}
              value={table.filters.type ?? 'all'}
              onChange={(value) => table.setFilter('type', value === 'all' ? undefined : value)}
              aria-label={t('settings.holidays.type')}
              options={[{ value: 'all', label: t('settings.holidays.allTypes') }, ...typeOptions]}
            />
            <TableSearch
              defaultValue={search}
              placeholder={t('settings.holidays.searchPlaceholder')}
              onSearch={(value) => table.setFilter('search', value || undefined)}
            />
          </>
        }
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
      />

      <CrudFormModal<HolidayFormValues>
        open={screen.isModalOpen}
        recordKey={screen.editing?.id ?? 'create'}
        title={screen.editing ? t('settings.holidays.editTitle') : t('settings.holidays.addTitle')}
        form={form}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={screen.closeModal}
        isSaving={screen.isSaving}
        submitError={screen.submitError}
      >
        <Form.Item
          label={t('settings.holidays.nameLabel')}
          name="name"
          rules={[
            { required: true, message: t('settings.validation.nameRequired') },
            { max: HOLIDAY_NAME_MAX_LENGTH, message: t('settings.validation.nameTooLong') },
          ]}
        >
          <Input placeholder={t('settings.holidays.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('settings.holidays.dateLabel')}
          name="holidayDate"
          rules={[{ required: true, message: t('settings.validation.dateRequired') }]}
          extra={t('settings.holidays.dateHint')}
        >
          {/* DD/MM/YYYY + vi_VN locale come from the app-level ConfigProvider (§4). */}
          <DatePicker
            className={styles.fullWidth}
            format="DD/MM/YYYY"
            placeholder={t('settings.holidays.datePlaceholder')}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.holidays.typeLabel')}
          name="type"
          rules={[{ required: true, message: t('settings.validation.typeRequired') }]}
        >
          <Select options={typeOptions} />
        </Form.Item>

        <Form.Item
          label={t('settings.holidays.noteLabel')}
          name="note"
          rules={[{ max: HOLIDAY_NOTE_MAX_LENGTH, message: t('settings.validation.noteTooLong') }]}
        >
          <Input.TextArea rows={2} placeholder={t('settings.holidays.notePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('settings.holidays.isPaidLabel')}
          name="isPaid"
          valuePropName="checked"
          extra={t('settings.holidays.isPaidHint')}
        >
          <Switch
            checkedChildren={t('settings.holidays.paid')}
            unCheckedChildren={t('settings.holidays.unpaid')}
          />
        </Form.Item>
      </CrudFormModal>
    </>
  );
}
