import { useMemo } from 'react';
import { Button, Form, Input, InputNumber, Select, Switch, Tag, type TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { BooleanTag } from '@/components/crud/BooleanTag';
import { CrudFormModal } from '@/components/crud/CrudFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { RowActions } from '@/components/crud/RowActions';
import { TableSearch } from '@/components/crud/TableSearch';
import { useAllDepartments } from '@/hooks/useDepartments';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import { useCrudScreen } from '@/hooks/useCrudScreen';
import { usePositions } from '@/hooks/usePositions';
import { parseBoolParam, parseEnumParam, parseIntParam, useTableQuery } from '@/hooks/useTableQuery';
import {
  MASTER_CODE_MAX_LENGTH,
  MASTER_CODE_PATTERN,
  MAX_POSITION_LEVEL,
  MAX_SALARY_VALUE,
  MIN_POSITION_LEVEL,
  POSITION_LEVELS,
  POSITION_NAME_MAX_LENGTH,
  POSITION_SORT_KEYS,
  type Position,
  type PositionPayload,
  type PositionSortKey,
} from '@/types/masterData.types';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import { formatCurrency } from '@/utils/format';
import styles from './settingsPage.module.css';

/**
 * `/settings/positions` — job titles, each owned by one department and graded
 * 1-5 (Staff → Director).
 *
 * The department is a required link, so the picker is fed from the tree endpoint
 * (every department, not just the first 100) and is always loaded on this page —
 * the table needs it for the filter, not only the form.
 */

interface PositionFormValues {
  code: string;
  name: string;
  departmentId: number;
  level: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  description?: string;
  isActive: boolean;
}

/**
 * Thousands-separated input for the two salary fields, so a user typing
 * 20000000 sees `20.000.000` while the form value stays a plain number (the API
 * takes VNĐ unformatted). Matches the separator used by `formatCurrency`.
 */
const SALARY_INPUT_PROPS = {
  min: 0,
  max: MAX_SALARY_VALUE,
  step: 1_000_000,
  formatter: (value?: string | number) =>
    value === undefined || value === '' ? '' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
  parser: (value?: string) => (value ? Number(value.replace(/\D/g, '')) : 0),
} as const;

export function PositionsPage() {
  const { t } = useTranslation();
  const canWrite = useCanWriteMasterData();
  const table = useTableQuery({ sort: 'code', order: 'asc' });
  const [form] = Form.useForm<PositionFormValues>();

  const search = table.filters.search;
  const departmentId = parseIntParam(table.filters.departmentId);
  const level = parseIntParam(table.filters.level);
  const isActive = parseBoolParam(table.filters.isActive);
  const hasFilters =
    Boolean(search) || departmentId !== undefined || level !== undefined || isActive !== undefined;

  // Unknown values are dropped rather than forwarded: `sort` is a strict
  // whitelist on the backend and an unlisted value answers 400.
  const sortKey = parseEnumParam<PositionSortKey>(table.sort, POSITION_SORT_KEYS) ?? 'code';
  const sortOrder = table.order ?? 'asc';

  const resource = usePositions({
    page: table.page,
    limit: table.pageSize,
    sort: sortKey,
    order: sortOrder,
    search,
    departmentId,
    level: level && level >= MIN_POSITION_LEVEL && level <= MAX_POSITION_LEVEL ? level : undefined,
    isActive,
  });

  const screen = useCrudScreen<Position, PositionPayload>({
    resource,
    entityName: t('settings.positions.entity'),
    rowTitle: (row) => row.name,
  });

  const { tree } = useAllDepartments();
  const departmentOptions = useMemo(
    () =>
      flattenDepartmentTree(tree).map(({ node, depth }) => ({
        value: node.id,
        // Non-breaking spaces so the indentation survives inside a <Select>.
        label: `${'  '.repeat(depth)}${node.name}`,
      })),
    [tree],
  );

  const levelOptions = POSITION_LEVELS.map((value) => ({
    value,
    label: t(`settings.positions.levels.${value}`),
  }));

  const rows = resource.data?.items ?? [];
  const total = resource.data?.meta.total ?? 0;

  const columns: TableProps<Position>['columns'] = [
    {
      title: t('settings.fields.code'),
      dataIndex: 'code',
      key: 'code',
      width: 150,
      sorter: true,
    },
    {
      title: t('settings.positions.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string) => <span className={styles.strongCell}>{name}</span>,
    },
    {
      title: t('settings.positions.department'),
      key: 'department',
      width: 220,
      render: (_value, row) => row.department?.name ?? <span className={styles.muted}>—</span>,
    },
    {
      title: t('settings.positions.level'),
      dataIndex: 'level',
      key: 'level',
      width: 140,
      sorter: true,
      render: (value: number) => (
        <Tag color="processing">
          {t(`settings.positions.levels.${value}`, { defaultValue: String(value) })}
        </Tag>
      ),
    },
    {
      title: t('settings.positions.salaryRange'),
      key: 'salary',
      width: 260,
      render: (_value, row) => {
        const { minSalary: min, maxSalary: max } = row;
        if (min !== null && max !== null) {
          return `${formatCurrency(min)} – ${formatCurrency(max)}`;
        }
        if (min !== null) {
          return t('settings.positions.salaryFrom', { value: formatCurrency(min) });
        }
        if (max !== null) {
          return t('settings.positions.salaryTo', { value: formatCurrency(max) });
        }
        return <span className={styles.muted}>{t('settings.positions.noSalary')}</span>;
      },
    },
    {
      title: t('settings.fields.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (value: boolean) => (
        <BooleanTag
          value={value}
          trueLabel={t('settings.status.active')}
          falseLabel={t('settings.status.inactive')}
        />
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
      {t('settings.positions.add')}
    </Button>
  ) : null;

  const initialValues: Partial<PositionFormValues> = screen.editing
    ? {
        code: screen.editing.code,
        name: screen.editing.name,
        departmentId: screen.editing.department?.id,
        level: screen.editing.level,
        minSalary: screen.editing.minSalary ?? undefined,
        maxSalary: screen.editing.maxSalary ?? undefined,
        description: screen.editing.description ?? undefined,
        isActive: screen.editing.isActive,
      }
    : { isActive: true, level: 1 };

  const handleSubmit = (values: PositionFormValues) => {
    void screen.submit({
      code: values.code.trim(),
      name: values.name.trim(),
      departmentId: values.departmentId,
      level: values.level,
      minSalary: values.minSalary ?? null,
      maxSalary: values.maxSalary ?? null,
      description: values.description?.trim() ? values.description.trim() : null,
      isActive: values.isActive,
    });
  };

  return (
    <>
      <PageHeader
        title={t('nav.positions')}
        subtitle={t('settings.positions.subtitle')}
        actions={addButton}
      />

      <DataTableCard<Position>
        columns={columns}
        rows={rows}
        isLoading={resource.isLoading}
        isRefreshing={resource.isFetching && !resource.isLoading}
        isError={resource.isError}
        onRetry={resource.refetch}
        errorMessage={t('settings.positions.loadError')}
        total={total}
        hasFilters={hasFilters}
        emptyAction={addButton}
        scrollX={1200}
        onSorterChange={table.setSorter}
        activeSort={{ key: sortKey, order: sortOrder }}
        filters={
          <>
            <TableSearch
              defaultValue={search}
              placeholder={t('settings.positions.searchPlaceholder')}
              onSearch={(value) => table.setFilter('search', value || undefined)}
            />
            <Select<number | 'all'>
              className={styles.filterSelectWide}
              value={departmentId ?? 'all'}
              onChange={(value) =>
                table.setFilter('departmentId', value === 'all' ? undefined : value)
              }
              aria-label={t('settings.positions.department')}
              options={[
                { value: 'all' as const, label: t('settings.positions.allDepartments') },
                ...departmentOptions,
              ]}
            />
            <Select<number | 'all'>
              className={styles.filterSelect}
              value={level ?? 'all'}
              onChange={(value) => table.setFilter('level', value === 'all' ? undefined : value)}
              aria-label={t('settings.positions.level')}
              options={[
                { value: 'all' as const, label: t('settings.positions.allLevels') },
                ...levelOptions,
              ]}
            />
            <Select<string>
              className={styles.filterSelect}
              value={table.filters.isActive ?? 'all'}
              onChange={(value) => table.setFilter('isActive', value === 'all' ? undefined : value)}
              aria-label={t('settings.fields.status')}
              options={[
                { value: 'all', label: t('settings.status.all') },
                { value: 'true', label: t('settings.status.active') },
                { value: 'false', label: t('settings.status.inactive') },
              ]}
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

      <CrudFormModal<PositionFormValues>
        open={screen.isModalOpen}
        recordKey={screen.editing?.id ?? 'create'}
        title={screen.editing ? t('settings.positions.editTitle') : t('settings.positions.addTitle')}
        form={form}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={screen.closeModal}
        isSaving={screen.isSaving}
        submitError={screen.submitError}
        width={720}
      >
        <Form.Item
          label={t('settings.fields.codeLabel')}
          name="code"
          rules={[
            { required: true, message: t('settings.validation.codeRequired') },
            { pattern: MASTER_CODE_PATTERN, message: t('settings.validation.codePattern') },
          ]}
          extra={t('settings.fields.codeHint')}
        >
          <Input
            placeholder={t('settings.positions.codePlaceholder')}
            maxLength={MASTER_CODE_MAX_LENGTH}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.positions.nameLabel')}
          name="name"
          rules={[
            { required: true, message: t('settings.validation.nameRequired') },
            { max: POSITION_NAME_MAX_LENGTH, message: t('settings.validation.nameTooLong') },
          ]}
        >
          <Input placeholder={t('settings.positions.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('settings.positions.departmentLabel')}
          name="departmentId"
          rules={[{ required: true, message: t('settings.validation.departmentRequired') }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('settings.positions.departmentPlaceholder')}
            options={departmentOptions}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.positions.levelLabel')}
          name="level"
          rules={[{ required: true, message: t('settings.validation.levelRequired') }]}
          extra={t('settings.positions.levelHint')}
        >
          <Select options={levelOptions} />
        </Form.Item>

        <Form.Item
          label={t('settings.positions.minSalaryLabel')}
          name="minSalary"
          extra={t('settings.positions.salaryHint')}
        >
          <InputNumber
            {...SALARY_INPUT_PROPS}
            className={styles.fullWidth}
            placeholder={t('settings.positions.minSalaryPlaceholder')}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.positions.maxSalaryLabel')}
          name="maxSalary"
          dependencies={['minSalary']}
          rules={[
            ({ getFieldValue }) => ({
              validator: (_rule, value: number | null | undefined) => {
                const min = getFieldValue('minSalary') as number | null | undefined;
                if (
                  typeof value === 'number' &&
                  typeof min === 'number' &&
                  value < min
                ) {
                  return Promise.reject(new Error(t('settings.validation.salaryRange')));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber
            {...SALARY_INPUT_PROPS}
            className={styles.fullWidth}
            placeholder={t('settings.positions.maxSalaryPlaceholder')}
          />
        </Form.Item>

        <Form.Item label={t('settings.fields.descriptionLabel')} name="description">
          <Input.TextArea rows={3} placeholder={t('settings.positions.descriptionPlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('settings.fields.statusLabel')}
          name="isActive"
          valuePropName="checked"
          extra={t('settings.fields.statusHint')}
        >
          <Switch
            checkedChildren={t('settings.status.active')}
            unCheckedChildren={t('settings.status.inactive')}
          />
        </Form.Item>
      </CrudFormModal>
    </>
  );
}
