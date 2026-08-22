import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Calendar,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  type TableProps,
} from 'antd';
import { LeftOutlined, PlusOutlined, RightOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { Solar } from 'lunar-javascript';
import { useTranslation } from 'react-i18next';
import { GenerateHolidaysModal } from '@/components/catalog/GenerateHolidaysModal';
import { PageHeader } from '@/components/layout/PageHeader';
import { CrudFormModal } from '@/components/crud/CrudFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { RowActions } from '@/components/crud/RowActions';
import { TableSearch } from '@/components/crud/TableSearch';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import { useCrudScreen } from '@/hooks/useCrudScreen';
import { useHolidays, useHolidaysByYear } from '@/hooks/useHolidays';
import { parseEnumParam, parseIntParam, useTableQuery } from '@/hooks/useTableQuery';
import {
  HOLIDAY_CALENDARS,
  HOLIDAY_CODE_MAX_LENGTH,
  HOLIDAY_NAME_MAX_LENGTH,
  HOLIDAY_NOTE_MAX_LENGTH,
  HOLIDAY_SORT_KEYS,
  HOLIDAY_TYPES,
  MAX_HOLIDAY_YEAR,
  MIN_HOLIDAY_YEAR,
  type Holiday,
  type HolidayCalendar,
  type HolidayDate,
  type HolidayPayload,
  type HolidaySortKey,
  type HolidayType,
} from '@/types/masterData.types';
import styles from './catalogPage.module.css';

const TYPE_COLORS: Record<string, string> = {
  national: 'red',
  company: 'blue',
  other: 'default',
};

const TYPE_DOT_STATUS: Record<string, 'error' | 'processing' | 'default'> = {
  national: 'error',
  company: 'processing',
  other: 'default',
};

function getLunarDay(date: Dayjs): { month: number; day: number; isFirstDay: boolean } {
  const lunar = Solar.fromYmd(date.year(), date.month() + 1, date.date()).getLunar();
  const month = lunar.getMonth();
  const day = lunar.getDay();
  return { month, day, isFirstDay: day === 1 };
}

interface HolidayFormValues {
  code: string;
  name: string;
  type: HolidayType;
  calendar: HolidayCalendar;
  month: number;
  day: number;
  offsetDays: number;
  durationDays: number;
  everyYear: boolean;
  year?: number;
  isPaid: boolean;
  isActive: boolean;
  sortOrder: number;
  note?: string | null;
}

export function HolidaysPage() {
  const { t } = useTranslation();
  const canWrite = useCanWriteMasterData();
  const table = useTableQuery({ sort: 'sortOrder', order: 'asc' });
  const [form] = Form.useForm<HolidayFormValues>();
  const [isGenerateOpen, setGenerateOpen] = useState(false);
  const [calViewMode, setCalViewMode] = useState<'month' | 'year'>('month');
  const [calendarMode, setCalendarMode] = useState<'solar' | 'lunar'>('solar');

  const search = table.filters.search;
  const rawYear = parseIntParam(table.filters.year);
  const year =
    rawYear && rawYear >= MIN_HOLIDAY_YEAR && rawYear <= MAX_HOLIDAY_YEAR ? rawYear : undefined;
  const type = parseEnumParam<HolidayType>(table.filters.type, HOLIDAY_TYPES);
  const hasFilters = Boolean(search) || year !== undefined || type !== undefined;

  const sortKey = parseEnumParam<HolidaySortKey>(table.sort, HOLIDAY_SORT_KEYS) ?? 'sortOrder';
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

  const calendarYear = year ?? dayjs().year();
  const calendarQuery = useHolidaysByYear(calendarYear);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, HolidayDate[]>();
    for (const h of calendarQuery.data ?? []) {
      const key = h.holidayDate.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), h]);
    }
    return map;
  }, [calendarQuery.data]);

  const screen = useCrudScreen<Holiday, HolidayPayload>({
    resource,
    entityName: t('settings.holidays.entity'),
    rowTitle: (row) =>
      row.year !== null
        ? `${row.name} (${row.year})`
        : `${row.name} (${t('settings.holidays.everyYear').toLowerCase()})`,
  });

  useEffect(() => {
    if (!screen.isModalOpen) return;
    if (screen.editing) {
      form.setFieldsValue({
        code: screen.editing.code,
        name: screen.editing.name,
        type: (screen.editing.type as HolidayType) ?? 'national',
        calendar: screen.editing.calendar ?? 'solar',
        month: screen.editing.month,
        day: screen.editing.day,
        offsetDays: screen.editing.offsetDays,
        durationDays: screen.editing.durationDays,
        everyYear: screen.editing.year === null,
        year: screen.editing.year ?? undefined,
        isPaid: screen.editing.isPaid,
        isActive: screen.editing.isActive,
        sortOrder: screen.editing.sortOrder,
        note: screen.editing.note ?? undefined,
      });
    } else {
      form.resetFields();
    }
  }, [screen.isModalOpen, screen.editing, form]);

  const rows = resource.data?.items ?? [];
  const total = resource.data?.meta.total ?? 0;

  const typeOptions = HOLIDAY_TYPES.map((value) => ({
    value,
    label: t(`settings.holidays.types.${value}`),
  }));

  const calendarOptions = HOLIDAY_CALENDARS.map((value) => ({
    value,
    label: t(`settings.holidays.calendars.${value}`),
  }));

  const columns: TableProps<Holiday>['columns'] = [
    {
      title: t('settings.holidays.name'),
      key: 'name',
      sorter: true,
      render: (_value, row) => (
        <span>
          <span className={styles.strongCell}>{row.name}</span>
          <br />
          <small className={styles.muted}>{row.code}</small>
        </span>
      ),
    },
    {
      title: t('settings.holidays.type'),
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (value: string) => (
        <Tag color={TYPE_COLORS[value] ?? 'default'}>
          {t(`settings.holidays.types.${value}`, { defaultValue: value })}
        </Tag>
      ),
    },
    {
      title: t('settings.holidays.calendar'),
      dataIndex: 'calendar',
      key: 'calendar',
      width: 120,
      render: (value: HolidayCalendar) =>
        t(`settings.holidays.calendars.${value}`, { defaultValue: value }),
    },
    {
      title: t('settings.holidays.anchor'),
      key: 'anchor',
      width: 200,
      render: (_value, row) => {
        const calLabel = t(`settings.holidays.calendars.${row.calendar}`, {
          defaultValue: row.calendar,
        });
        const base = `${row.day}/${row.month} (${calLabel})`;
        const isDefault = row.offsetDays === 0 && row.durationDays === 1;
        const extra = isDefault ? '' : ` - ${row.offsetDays}&${row.durationDays} ngày`;
        return <span>{base}{extra}</span>;
      },
    },
    {
      title: t('settings.holidays.year'),
      dataIndex: 'year',
      key: 'year',
      width: 110,
      align: 'right',
      sorter: true,
      render: (value: number | null) =>
        value === null ? (
          <span className={styles.muted}>{t('settings.holidays.everyYear')}</span>
        ) : (
          value
        ),
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

  const headerActions = (
    <Space wrap>
      {canWrite && (
        <Button icon={<ThunderboltOutlined />} onClick={() => setGenerateOpen(true)}>
          {t('settings.holidays.generate.action')}
        </Button>
      )}
      {addButton}
    </Space>
  );

  const renderSolarCell = (value: Dayjs, info: { type: string }) => {
    if (info.type !== 'date') return null;
    const { month, day, isFirstDay } = getLunarDay(value);
    const lunarLabel = isFirstDay ? `T.${month}` : String(day);
    const hs = holidaysByDate.get(value.format('YYYY-MM-DD')) ?? [];
    return (
      <div className={styles.calendarCell}>
        <span className={styles.lunarDay}>{lunarLabel}</span>
        {hs.length > 0 && (
          <Tooltip title={hs.map((h) => h.name).join('\n')}>
            <span className={styles.calendarDots}>
              {hs.map((h, i) => (
                <Badge key={i} status={TYPE_DOT_STATUS[h.type] ?? 'default'} />
              ))}
            </span>
          </Tooltip>
        )}
      </div>
    );
  };

  const renderLunarCell = (value: Dayjs, info: { type: string; originNode: React.ReactElement }) => {
    if (info.type !== 'date') return info.originNode;
    const { month, day, isFirstDay } = getLunarDay(value);
    const hs = holidaysByDate.get(value.format('YYYY-MM-DD')) ?? [];
    const isToday = value.isSame(dayjs(), 'day');
    return (
      <div className={`${styles.lunarCell} ${isToday ? styles.lunarCellToday : ''}`}>
        <span className={styles.lunarCellDay}>{isFirstDay ? `T.${month}` : day}</span>
        <span className={styles.lunarCellSolar}>{value.date()}</span>
        {hs.length > 0 && (
          <Tooltip title={hs.map((h) => h.name).join('\n')}>
            <span className={styles.calendarDots}>
              {hs.map((h, i) => (
                <Badge key={i} status={TYPE_DOT_STATUS[h.type] ?? 'default'} />
              ))}
            </span>
          </Tooltip>
        )}
      </div>
    );
  };

  const initialValues: Partial<HolidayFormValues> = screen.editing
    ? {
        code: screen.editing.code,
        name: screen.editing.name,
        type: (screen.editing.type as HolidayType) ?? 'national',
        calendar: screen.editing.calendar ?? 'solar',
        month: screen.editing.month,
        day: screen.editing.day,
        offsetDays: screen.editing.offsetDays,
        durationDays: screen.editing.durationDays,
        everyYear: screen.editing.year === null,
        year: screen.editing.year ?? undefined,
        isPaid: screen.editing.isPaid,
        isActive: screen.editing.isActive,
        sortOrder: screen.editing.sortOrder,
        note: screen.editing.note ?? undefined,
      }
    : {
        type: 'national',
        calendar: 'solar',
        month: 1,
        day: 1,
        offsetDays: 0,
        durationDays: 1,
        everyYear: true,
        isPaid: true,
        isActive: true,
        sortOrder: 0,
      };

  const handleSubmit = (values: HolidayFormValues) => {
    void screen.submit({
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      type: values.type,
      calendar: values.calendar,
      month: values.month,
      day: values.day,
      offsetDays: values.offsetDays,
      durationDays: values.durationDays,
      year: values.everyYear ? null : (values.year ?? null),
      isPaid: values.isPaid,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
      note: values.note?.trim() ? values.note.trim() : null,
    });
  };

  return (
    <>
      <PageHeader
        title={t('nav.holidays')}
        subtitle={t('settings.holidays.subtitle')}
        actions={headerActions}
      />

      <div className={styles.splitLayout}>
        {/* Left: rule definitions table */}
        <div className={styles.tablePanel}>
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
            scrollX={800}
            onSorterChange={table.setSorter}
            activeSort={{ key: sortKey, order: sortOrder }}
            filters={
              <>
                <DatePicker
                  picker="year"
                  className={styles.filterSelect}
                  value={year ? dayjs().year(year) : null}
                  onChange={(value) =>
                    table.setFilter('year', value ? value.year() : undefined)
                  }
                  placeholder={t('settings.holidays.allYears')}
                  aria-label={t('settings.holidays.year')}
                />
                <Select<string>
                  className={styles.filterSelect}
                  value={table.filters.type ?? 'all'}
                  onChange={(value) =>
                    table.setFilter('type', value === 'all' ? undefined : value)
                  }
                  aria-label={t('settings.holidays.type')}
                  options={[
                    { value: 'all', label: t('settings.holidays.allTypes') },
                    ...typeOptions,
                  ]}
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
        </div>

        {/* Right: compact calendar */}
        <Card
          variant="borderless"
          className={styles.calPanel}
          styles={{ body: { padding: '8px' } }}
        >
          {calendarQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (calendarQuery.data?.length ?? 0) === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('settings.holidays.view.empty', { year: calendarYear })}
            />
          ) : (
            <Calendar
              key={`${calendarYear}-${calendarMode}-${calViewMode}`}
              fullscreen={false}
              mode={calViewMode}
              validRange={[
                dayjs().year(calendarYear).startOf('year'),
                dayjs().year(calendarYear).endOf('year'),
              ]}
              headerRender={({ value, onChange }) => {
                const m = value.month();
                const monthCount = (calendarQuery.data ?? []).filter(
                  (h) => dayjs(h.holidayDate).month() === m,
                ).length;
                const totalCount = calendarQuery.data?.length ?? 0;
                const displayCount = calViewMode === 'month' ? monthCount : totalCount;
                return (
                  <div className={styles.calHeader}>
                    {/* Left: year picker */}
                    <DatePicker
                      picker="year"
                      allowClear={false}
                      size="small"
                      value={dayjs().year(calendarYear)}
                      onChange={(v) => {
                        table.setFilter('year', v ? v.year() : undefined);
                        if (v) onChange(value.year(v.year()));
                      }}
                      className={styles.calYearPicker}
                    />
                    {/* Center: [<] title + count [>] */}
                    <div className={styles.calNavGroup}>
                      {calViewMode === 'month' && (
                        <button
                          type="button"
                          className={styles.calNavBtn}
                          onClick={() => onChange(value.subtract(1, 'month'))}
                        >
                          <LeftOutlined />
                        </button>
                      )}
                      <div className={styles.calNavCenter}>
                        <span className={styles.calMonthName}>
                          {calViewMode === 'month' ? `Tháng ${m + 1}` : `Năm ${calendarYear}`}
                        </span>
                        <span className={styles.calCount2}>
                          {displayCount} {t('settings.holidays.entity')}
                        </span>
                      </div>
                      {calViewMode === 'month' && (
                        <button
                          type="button"
                          className={styles.calNavBtn}
                          onClick={() => onChange(value.add(1, 'month'))}
                        >
                          <RightOutlined />
                        </button>
                      )}
                    </div>
                    {/* Right: mode toggles */}
                    <div className={styles.calHeaderRight}>
                      <Segmented
                        size="small"
                        value={calendarMode}
                        onChange={(v) => setCalendarMode(v as 'solar' | 'lunar')}
                        options={[
                          { label: 'Dương', value: 'solar' },
                          { label: 'Âm', value: 'lunar' },
                        ]}
                      />
                      <Segmented
                        size="small"
                        value={calViewMode}
                        onChange={(v) => setCalViewMode(v as 'month' | 'year')}
                        options={[
                          { label: 'Tháng', value: 'month' },
                          { label: 'Năm', value: 'year' },
                        ]}
                      />
                    </div>
                  </div>
                );
              }}
              {...(calViewMode === 'month'
                ? calendarMode === 'solar'
                  ? { cellRender: renderSolarCell }
                  : { fullCellRender: renderLunarCell }
                : {})}
            />
          )}
        </Card>
      </div>

      <GenerateHolidaysModal
        open={isGenerateOpen}
        defaultYear={year}
        onClose={() => setGenerateOpen(false)}
      />

      <CrudFormModal<HolidayFormValues>
        open={screen.isModalOpen}
        recordKey={screen.editing?.id ?? 'create'}
        title={
          screen.editing
            ? t('settings.holidays.editTitle')
            : t('settings.holidays.addTitle')
        }
        form={form}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={screen.closeModal}
        isSaving={screen.isSaving}
        submitError={screen.submitError}
      >
          <Row gutter={12}>
          <Col span={10}>
            <Form.Item
              label={t('settings.holidays.codeLabel')}
              name="code"
              rules={[
                { required: true, message: t('settings.validation.nameRequired') },
                { max: HOLIDAY_CODE_MAX_LENGTH, message: t('settings.validation.nameTooLong') },
                { pattern: /^[A-Z0-9_]+$/, message: 'Chỉ dùng chữ IN HOA, số và _.' },
              ]}
            >
              <Input
                placeholder={t('settings.holidays.codePlaceholder')}
                style={{ textTransform: 'uppercase' }}
              />
            </Form.Item>
          </Col>
          <Col span={14}>
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
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label={t('settings.holidays.typeLabel')}
              name="type"
              rules={[{ required: true }]}
            >
              <Select options={typeOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('settings.holidays.calendarLabel')}
              name="calendar"
              rules={[{ required: true }]}
            >
              <Select options={calendarOptions} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={6}>
            <Form.Item
              label={t('settings.holidays.monthLabel')}
              name="month"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={12} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={t('settings.holidays.dayLabel')}
              name="day"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={31} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={t('settings.holidays.offsetDaysLabel')}
              name="offsetDays"
              extra={t('settings.holidays.offsetDaysHint')}
            >
              <InputNumber min={-366} max={366} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              label={t('settings.holidays.durationDaysLabel')}
              name="durationDays"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={30} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={t('settings.holidays.yearLabel')}
          extra={t('settings.holidays.yearHint')}
        >
          <Row gutter={12} align="middle">
            <Col>
              <Form.Item name="everyYear" valuePropName="checked" noStyle>
                <Checkbox>{t('settings.holidays.everyYear')}</Checkbox>
              </Form.Item>
            </Col>
            <Col flex="1">
              <Form.Item
                noStyle
                shouldUpdate={(prev: HolidayFormValues, next: HolidayFormValues) =>
                  prev.everyYear !== next.everyYear
                }
              >
                {({ getFieldValue }) =>
                  !getFieldValue('everyYear') ? (
                    <Form.Item name="year" noStyle rules={[{ required: true }]}>
                      <InputNumber
                        min={MIN_HOLIDAY_YEAR}
                        max={MAX_HOLIDAY_YEAR}
                        placeholder={t('settings.holidays.specificYear')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label={t('settings.holidays.isPaidLabel')}
              name="isPaid"
              valuePropName="checked"
            >
              <Switch
                checkedChildren={t('settings.holidays.paid')}
                unCheckedChildren={t('settings.holidays.unpaid')}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={t('settings.holidays.isActiveLabel')}
              name="isActive"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label={t('settings.holidays.sortOrderLabel')} name="sortOrder">
              <InputNumber min={0} max={9999} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item
              label={t('settings.holidays.noteLabel')}
              name="note"
              rules={[
                { max: HOLIDAY_NOTE_MAX_LENGTH, message: t('settings.validation.noteTooLong') },
              ]}
            >
              <Input placeholder={t('settings.holidays.notePlaceholder')} />
            </Form.Item>
          </Col>
        </Row>
      </CrudFormModal>
    </>
  );
}
