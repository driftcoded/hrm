import { Button, Form, Input, InputNumber, Select, Switch, Tooltip, type TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { BooleanTag } from '@/components/crud/BooleanTag';
import { CrudFormModal } from '@/components/crud/CrudFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { RowActions } from '@/components/crud/RowActions';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import { useCrudScreen } from '@/hooks/useCrudScreen';
import { useLeaveTypes } from '@/hooks/useLeaveTypes';
import { parseBoolParam, parseEnumParam, useTableQuery } from '@/hooks/useTableQuery';
import {
  LEAVE_GENDERS,
  LEAVE_TYPE_NAME_MAX_LENGTH,
  MASTER_CODE_MAX_LENGTH,
  MASTER_CODE_PATTERN,
  MAX_DAYS_PER_YEAR,
  MAX_SMALLINT,
  MIN_LEAVE_MIN_DAYS,
  type LeaveApplicableGender,
  type LeaveType,
  type LeaveTypePayload,
} from '@/types/masterData.types';
import styles from './settingsPage.module.css';

/**
 * `/settings/leave-types` — leave categories and the policy attached to each
 * (entitlement per year, paid or not, notice period, gender applicability).
 *
 * `GET /leave-types` returns a PLAIN ARRAY: the table's primary key is a TINYINT,
 * so there can never be more than 255 rows and the endpoint takes no pagination,
 * no search and no sort. The table therefore renders every row with
 * `pagination={undefined}`, and the filter bar offers only the two filters the API
 * actually honours (`isActive`, `applicableGender`) instead of controls that would
 * be silently dropped by the backend's `whitelist: true` validation.
 *
 * `description` holds the legal citation (Điều 113 BLLĐ 2019, Luật BHXH …), which
 * runs to several lines — it is truncated in the cell with the full text in a
 * tooltip rather than allowed to triple the row height.
 */

interface LeaveTypeFormValues {
  code: string;
  name: string;
  daysPerYear: number;
  minDays?: number;
  maxConsecutive?: number | null;
  advanceNoticeDays?: number;
  applicableGender: LeaveApplicableGender;
  sortOrder?: number;
  description?: string;
  isPaid: boolean;
  requireApproval: boolean;
  isActive: boolean;
}

export function LeaveTypesPage() {
  const { t } = useTranslation();
  const canWrite = useCanWriteMasterData();
  const table = useTableQuery();
  const [form] = Form.useForm<LeaveTypeFormValues>();

  const isActive = parseBoolParam(table.filters.isActive);
  const applicableGender = parseEnumParam<LeaveApplicableGender>(
    table.filters.applicableGender,
    LEAVE_GENDERS,
  );
  const hasFilters = isActive !== undefined || applicableGender !== undefined;

  const resource = useLeaveTypes({ isActive, applicableGender });

  const screen = useCrudScreen<LeaveType, LeaveTypePayload>({
    resource,
    entityName: t('settings.leaveTypes.entity'),
    rowTitle: (row) => row.name,
  });

  const rows = resource.data ?? [];

  const genderOptions = LEAVE_GENDERS.map((value) => ({
    value,
    label: t(`settings.leaveTypes.genders.${value}`),
  }));

  const columns: TableProps<LeaveType>['columns'] = [
    { title: t('settings.fields.code'), dataIndex: 'code', key: 'code', width: 150 },
    {
      title: t('settings.leaveTypes.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => <span className={styles.strongCell}>{name}</span>,
    },
    {
      title: t('settings.leaveTypes.daysPerYear'),
      dataIndex: 'daysPerYear',
      key: 'daysPerYear',
      width: 130,
      align: 'right',
      // 0 means "no fixed entitlement" (unpaid leave, time off in lieu).
      render: (value: number) =>
        value === 0 ? (
          <span className={styles.muted}>{t('settings.leaveTypes.noEntitlement')}</span>
        ) : (
          t('settings.leaveTypes.days', { count: value })
        ),
    },
    {
      title: t('settings.leaveTypes.isPaid'),
      dataIndex: 'isPaid',
      key: 'isPaid',
      width: 130,
      render: (value: boolean) => (
        <BooleanTag
          value={value}
          trueLabel={t('settings.leaveTypes.paid')}
          falseLabel={t('settings.leaveTypes.unpaid')}
        />
      ),
    },
    {
      title: t('settings.leaveTypes.requireApproval'),
      dataIndex: 'requireApproval',
      key: 'requireApproval',
      width: 130,
      render: (value: boolean) => (
        <BooleanTag
          value={value}
          trueLabel={t('common.yes')}
          falseLabel={t('common.no')}
          trueColor="processing"
        />
      ),
    },
    {
      title: t('settings.leaveTypes.maxConsecutive'),
      dataIndex: 'maxConsecutive',
      key: 'maxConsecutive',
      width: 150,
      align: 'right',
      render: (value: number | null) =>
        value === null ? (
          <span className={styles.muted}>{t('settings.leaveTypes.unlimited')}</span>
        ) : (
          t('settings.leaveTypes.days', { count: value })
        ),
    },
    {
      title: t('settings.leaveTypes.advanceNotice'),
      dataIndex: 'advanceNoticeDays',
      key: 'advanceNoticeDays',
      width: 140,
      align: 'right',
      render: (value: number) =>
        value === 0 ? (
          <span className={styles.muted}>{t('settings.leaveTypes.noNotice')}</span>
        ) : (
          t('settings.leaveTypes.days', { count: value })
        ),
    },
    {
      title: t('settings.leaveTypes.applicableGender'),
      dataIndex: 'applicableGender',
      key: 'applicableGender',
      width: 130,
      render: (value: string) =>
        t(`settings.leaveTypes.genders.${value}`, { defaultValue: value }),
    },
    {
      title: t('settings.leaveTypes.legalBasis'),
      dataIndex: 'description',
      key: 'description',
      width: 260,
      render: (value: string | null) =>
        value ? (
          <Tooltip title={value}>
            <span className={styles.clampedText}>{value}</span>
          </Tooltip>
        ) : (
          <span className={styles.muted}>—</span>
        ),
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
      {t('settings.leaveTypes.add')}
    </Button>
  ) : null;

  const initialValues: Partial<LeaveTypeFormValues> = screen.editing
    ? {
        code: screen.editing.code,
        name: screen.editing.name,
        daysPerYear: screen.editing.daysPerYear,
        minDays: screen.editing.minDays,
        maxConsecutive: screen.editing.maxConsecutive ?? undefined,
        advanceNoticeDays: screen.editing.advanceNoticeDays,
        applicableGender: (screen.editing.applicableGender as LeaveApplicableGender) ?? 'all',
        sortOrder: screen.editing.sortOrder,
        description: screen.editing.description ?? undefined,
        isPaid: screen.editing.isPaid,
        requireApproval: screen.editing.requireApproval,
        isActive: screen.editing.isActive,
      }
    : {
        // Backend defaults, restated so the form shows what will be saved.
        daysPerYear: 12,
        minDays: MIN_LEAVE_MIN_DAYS,
        advanceNoticeDays: 1,
        applicableGender: 'all',
        sortOrder: 0,
        isPaid: true,
        requireApproval: true,
        isActive: true,
      };

  const handleSubmit = (values: LeaveTypeFormValues) => {
    void screen.submit({
      code: values.code.trim(),
      name: values.name.trim(),
      daysPerYear: values.daysPerYear,
      minDays: values.minDays ?? MIN_LEAVE_MIN_DAYS,
      // `null` is "no cap" — an empty input must clear the cap, not keep the old one.
      maxConsecutive: values.maxConsecutive ?? null,
      advanceNoticeDays: values.advanceNoticeDays ?? 0,
      applicableGender: values.applicableGender,
      sortOrder: values.sortOrder ?? 0,
      description: values.description?.trim() ? values.description.trim() : null,
      isPaid: values.isPaid,
      requireApproval: values.requireApproval,
      isActive: values.isActive,
    });
  };

  return (
    <>
      <PageHeader
        title={t('nav.leaveTypes')}
        subtitle={t('settings.leaveTypes.subtitle')}
        actions={addButton}
      />

      <DataTableCard<LeaveType>
        columns={columns}
        rows={rows}
        isLoading={resource.isLoading}
        isRefreshing={resource.isFetching && !resource.isLoading}
        isError={resource.isError}
        onRetry={resource.refetch}
        errorMessage={t('settings.leaveTypes.loadError')}
        total={rows.length}
        hasFilters={hasFilters}
        emptyAction={addButton}
        scrollX={1800}
        filters={
          <>
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
            <Select<string>
              className={styles.filterSelect}
              value={table.filters.applicableGender ?? 'any'}
              onChange={(value) =>
                table.setFilter('applicableGender', value === 'any' ? undefined : value)
              }
              aria-label={t('settings.leaveTypes.applicableGender')}
              options={[
                { value: 'any', label: t('settings.leaveTypes.allGenders') },
                ...genderOptions,
              ]}
            />
          </>
        }
      />

      <CrudFormModal<LeaveTypeFormValues>
        open={screen.isModalOpen}
        recordKey={screen.editing?.id ?? 'create'}
        title={
          screen.editing ? t('settings.leaveTypes.editTitle') : t('settings.leaveTypes.addTitle')
        }
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
            placeholder={t('settings.leaveTypes.codePlaceholder')}
            maxLength={MASTER_CODE_MAX_LENGTH}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.nameLabel')}
          name="name"
          rules={[
            { required: true, message: t('settings.validation.nameRequired') },
            { max: LEAVE_TYPE_NAME_MAX_LENGTH, message: t('settings.validation.nameTooLong') },
          ]}
        >
          <Input placeholder={t('settings.leaveTypes.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.daysPerYearLabel')}
          name="daysPerYear"
          rules={[{ required: true, message: t('settings.validation.daysPerYearRequired') }]}
          extra={t('settings.leaveTypes.daysPerYearHint')}
        >
          <InputNumber
            className={styles.fullWidth}
            min={0}
            max={MAX_DAYS_PER_YEAR}
            step={0.5}
            precision={1}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.minDaysLabel')}
          name="minDays"
          extra={t('settings.leaveTypes.minDaysHint')}
        >
          <InputNumber
            className={styles.fullWidth}
            min={MIN_LEAVE_MIN_DAYS}
            max={MAX_DAYS_PER_YEAR}
            step={0.5}
            precision={1}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.maxConsecutiveLabel')}
          name="maxConsecutive"
          extra={t('settings.leaveTypes.maxConsecutiveHint')}
        >
          <InputNumber
            className={styles.fullWidth}
            min={1}
            max={MAX_SMALLINT}
            precision={0}
            placeholder={t('settings.leaveTypes.unlimited')}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.advanceNoticeLabel')}
          name="advanceNoticeDays"
          extra={t('settings.leaveTypes.advanceNoticeHint')}
        >
          <InputNumber className={styles.fullWidth} min={0} max={MAX_SMALLINT} precision={0} />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.applicableGenderLabel')}
          name="applicableGender"
          rules={[{ required: true, message: t('settings.validation.genderRequired') }]}
        >
          <Select options={genderOptions} />
        </Form.Item>

        <Form.Item label={t('settings.fields.sortOrderLabel')} name="sortOrder">
          <InputNumber className={styles.fullWidth} min={0} max={MAX_SMALLINT} precision={0} />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.descriptionLabel')}
          name="description"
          extra={t('settings.leaveTypes.descriptionHint')}
        >
          <Input.TextArea rows={3} placeholder={t('settings.leaveTypes.descriptionPlaceholder')} />
        </Form.Item>

        <Form.Item label={t('settings.leaveTypes.isPaidLabel')} name="isPaid" valuePropName="checked">
          <Switch
            checkedChildren={t('settings.leaveTypes.paid')}
            unCheckedChildren={t('settings.leaveTypes.unpaid')}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.leaveTypes.requireApprovalLabel')}
          name="requireApproval"
          valuePropName="checked"
        >
          <Switch checkedChildren={t('common.yes')} unCheckedChildren={t('common.no')} />
        </Form.Item>

        <Form.Item
          label={t('settings.fields.statusLabel')}
          name="isActive"
          valuePropName="checked"
          extra={t('settings.leaveTypes.statusHint')}
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
