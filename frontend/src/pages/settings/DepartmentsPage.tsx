import { useMemo } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Switch,
  TreeSelect,
  type TableProps,
  type TreeSelectProps,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { BooleanTag } from '@/components/crud/BooleanTag';
import { CrudFormModal } from '@/components/crud/CrudFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { RowActions } from '@/components/crud/RowActions';
import { TableSearch } from '@/components/crud/TableSearch';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import { useCrudScreen } from '@/hooks/useCrudScreen';
import { useAllDepartments, useDepartmentTree, useDepartments } from '@/hooks/useDepartments';
import {
  parseBoolParam,
  parseEnumParam,
  useTableQuery,
  type TableQuery,
} from '@/hooks/useTableQuery';
import {
  DEPARTMENT_NAME_MAX_LENGTH,
  DEPARTMENT_SORT_KEYS,
  MASTER_CODE_MAX_LENGTH,
  MASTER_CODE_PATTERN,
  MAX_SORT_ORDER,
  type Department,
  type DepartmentPayload,
  type DepartmentSortKey,
  type DepartmentTreeNode,
} from '@/types/masterData.types';
import { collectSubtreeIds, flattenDepartmentTree, toTableTreeData } from '@/utils/departmentTree';
import styles from './settingsPage.module.css';

/**
 * `/settings/departments` — master data for the company's department hierarchy.
 *
 * Two views, because one table cannot do both jobs honestly:
 *   - **Cây** (default) reads `GET /departments/tree`, which returns the whole
 *     nested structure and ignores pagination/filters. This is the view that
 *     answers "how is the company organised".
 *   - **Danh sách** reads the paginated `GET /departments` and is the one that
 *     supports search, the active filter, sorting and `?page=`.
 * Switching does not silently drop a filter, because each view only offers the
 * controls its endpoint actually honours.
 *
 * MANAGER FIELD: `managerId` is an `employees.id`, but there is no employees
 * endpoint until Giai đoạn 3 — so this is a numeric input with the current
 * manager's name shown beside it, not a picker. See the form field below.
 */

interface DepartmentFormValues {
  code: string;
  name: string;
  parentId?: number | null;
  managerId?: number | null;
  sortOrder?: number;
  description?: string;
  isActive: boolean;
}

type DepartmentView = 'tree' | 'list';

const VIEW_PARAM = 'view';

function readView(table: TableQuery): DepartmentView {
  return table.filters[VIEW_PARAM] === 'list' ? 'list' : 'tree';
}

type ParentOptionNode = NonNullable<TreeSelectProps['treeData']>[number];

/**
 * `treeData` for the parent picker, with the edited department and its whole
 * subtree removed — the backend answers `DEPARTMENT_CYCLE` for those, so offering
 * them would be offering a guaranteed error.
 */
function toParentOptions(
  nodes: DepartmentTreeNode[] | undefined,
  excluded: Set<number>,
): ParentOptionNode[] {
  return (nodes ?? [])
    .filter((node) => !excluded.has(node.id))
    .map((node) => {
      const children = toParentOptions(node.children, excluded);
      return {
        value: node.id,
        title: `${node.name} (${node.code})`,
        ...(children.length > 0 ? { children } : {}),
      };
    });
}

export function DepartmentsPage() {
  const { t } = useTranslation();
  const canWrite = useCanWriteMasterData();
  const table = useTableQuery({ sort: 'sortOrder', order: 'asc' });
  const [form] = Form.useForm<DepartmentFormValues>();

  const view = readView(table);
  const search = table.filters.search;
  const isActive = parseBoolParam(table.filters.isActive);
  const hasFilters = Boolean(search) || isActive !== undefined;

  const listFilters = {
    page: table.page,
    limit: table.pageSize,
    sort: parseEnumParam<DepartmentSortKey>(table.sort, DEPARTMENT_SORT_KEYS) ?? 'sortOrder',
    order: table.order ?? 'asc',
    search,
    isActive,
  };

  // Both hooks are always called (rules of hooks) but only the active view's
  // query is enabled, so switching views does not double-fetch.
  const treeResource = useDepartmentTree(view === 'tree');
  const listResource = useDepartments(listFilters, view === 'list');
  const resource = view === 'tree' ? treeResource : listResource;

  const screen = useCrudScreen<Department, DepartmentPayload>({
    resource,
    entityName: t('settings.departments.entity'),
    rowTitle: (row) => row.name,
  });

  const treeRows = useMemo(() => toTableTreeData(treeResource.data), [treeResource.data]);
  const treeCount = useMemo(() => flattenDepartmentTree(treeResource.data).length, [
    treeResource.data,
  ]);

  const rows: Department[] = view === 'tree' ? treeRows : (listResource.data?.items ?? []);
  const total = view === 'tree' ? treeCount : (listResource.data?.meta.total ?? 0);

  /**
   * The parent picker always needs the full tree, including in list view where
   * the table itself is paginated. Fetching is deferred until the modal opens; in
   * tree view this reads the cache the table already filled (same query key).
   */
  const { tree: parentTree } = useAllDepartments(screen.isModalOpen);
  const excludedParents = useMemo(
    () => (screen.editing ? collectSubtreeIds(parentTree, screen.editing.id) : new Set<number>()),
    [parentTree, screen.editing],
  );
  const parentOptions = useMemo(
    () => toParentOptions(parentTree, excludedParents),
    [excludedParents, parentTree],
  );

  const columns: TableProps<Department>['columns'] = [
    {
      title: t('settings.departments.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: view === 'list',
      render: (name: string) => <span className={styles.strongCell}>{name}</span>,
    },
    {
      title: t('settings.fields.code'),
      dataIndex: 'code',
      key: 'code',
      width: 130,
      sorter: view === 'list',
    },
    {
      title: t('settings.departments.manager'),
      key: 'manager',
      width: 180,
      render: (_value, row) => row.manager?.fullName ?? <span className={styles.muted}>—</span>,
    },
    {
      title: t('settings.departments.employeeCount'),
      dataIndex: 'employeeCount',
      key: 'employeeCount',
      width: 110,
      align: 'right',
    },
    {
      title: t('settings.fields.sortOrder'),
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 100,
      align: 'right',
      sorter: view === 'list',
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
      {t('settings.departments.add')}
    </Button>
  ) : null;

  const initialValues: Partial<DepartmentFormValues> = screen.editing
    ? {
        code: screen.editing.code,
        name: screen.editing.name,
        parentId: screen.editing.parentId ?? undefined,
        managerId: screen.editing.manager?.id ?? undefined,
        sortOrder: screen.editing.sortOrder,
        description: screen.editing.description ?? undefined,
        isActive: screen.editing.isActive,
      }
    : { isActive: true, sortOrder: 0 };

  const handleSubmit = (values: DepartmentFormValues) => {
    void screen.submit({
      code: values.code.trim(),
      name: values.name.trim(),
      // `null` clears the link server-side; `undefined` would leave it unchanged.
      parentId: values.parentId ?? null,
      managerId: values.managerId ?? null,
      sortOrder: values.sortOrder ?? 0,
      description: values.description?.trim() ? values.description.trim() : null,
      isActive: values.isActive,
    });
  };

  return (
    <>
      <PageHeader
        title={t('nav.departments')}
        subtitle={t('settings.departments.subtitle')}
        actions={addButton}
      />

      <DataTableCard<Department>
        columns={columns}
        rows={rows}
        isLoading={resource.isLoading}
        isRefreshing={resource.isFetching && !resource.isLoading}
        isError={resource.isError}
        onRetry={resource.refetch}
        errorMessage={t('settings.departments.loadError')}
        total={total}
        hasFilters={view === 'list' && hasFilters}
        emptyAction={addButton}
        scrollX={960}
        expandable={view === 'tree' ? { defaultExpandAllRows: true } : undefined}
        filters={
          <>
            <Segmented<DepartmentView>
              value={view}
              onChange={(value) => table.setFilter(VIEW_PARAM, value)}
              options={[
                { value: 'tree', label: t('settings.departments.viewTree') },
                { value: 'list', label: t('settings.departments.viewList') },
              ]}
            />
            {view === 'list' && (
              <>
                <TableSearch
                  defaultValue={search}
                  placeholder={t('settings.departments.searchPlaceholder')}
                  onSearch={(value) => table.setFilter('search', value || undefined)}
                />
                <Select<string>
                  className={styles.filterSelect}
                  value={table.filters.isActive ?? 'all'}
                  onChange={(value) =>
                    table.setFilter('isActive', value === 'all' ? undefined : value)
                  }
                  aria-label={t('settings.fields.status')}
                  options={[
                    { value: 'all', label: t('settings.status.all') },
                    { value: 'true', label: t('settings.status.active') },
                    { value: 'false', label: t('settings.status.inactive') },
                  ]}
                />
              </>
            )}
          </>
        }
        pagination={
          view === 'list'
            ? {
                page: table.page,
                pageSize: table.pageSize,
                total,
                onChange: table.setPagination,
              }
            : undefined
        }
        onSorterChange={view === 'list' ? table.setSorter : undefined}
        activeSort={view === 'list' ? { key: listFilters.sort, order: listFilters.order } : undefined}
      />

      <CrudFormModal<DepartmentFormValues>
        open={screen.isModalOpen}
        recordKey={screen.editing?.id ?? 'create'}
        title={
          screen.editing ? t('settings.departments.editTitle') : t('settings.departments.addTitle')
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
            placeholder={t('settings.departments.codePlaceholder')}
            maxLength={MASTER_CODE_MAX_LENGTH}
          />
        </Form.Item>

        <Form.Item
          label={t('settings.departments.nameLabel')}
          name="name"
          rules={[
            { required: true, message: t('settings.validation.nameRequired') },
            { max: DEPARTMENT_NAME_MAX_LENGTH, message: t('settings.validation.nameTooLong') },
          ]}
        >
          <Input placeholder={t('settings.departments.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('settings.departments.parentLabel')}
          name="parentId"
          extra={t('settings.departments.parentHint')}
        >
          <TreeSelect
            allowClear
            treeDefaultExpandAll
            placeholder={t('settings.departments.parentPlaceholder')}
            treeData={parentOptions}
          />
        </Form.Item>

        {/*
          No employee picker exists yet: `/employees` ships in Giai đoạn 3, so
          there is nothing to populate a dropdown from. A numeric employee id is
          what the API takes, and the `extra` line names the person currently
          assigned so the field is not a blind number.
        */}
        <Form.Item
          label={t('settings.departments.managerLabel')}
          name="managerId"
          extra={
            screen.editing?.manager
              ? t('settings.departments.managerCurrent', {
                  name: screen.editing.manager.fullName,
                })
              : t('settings.departments.managerHint')
          }
        >
          <InputNumber
            className={styles.fullWidth}
            min={1}
            step={1}
            precision={0}
            placeholder={t('settings.departments.managerPlaceholder')}
          />
        </Form.Item>

        <Form.Item label={t('settings.fields.sortOrderLabel')} name="sortOrder">
          <InputNumber className={styles.fullWidth} min={0} max={MAX_SORT_ORDER} precision={0} />
        </Form.Item>

        <Form.Item label={t('settings.fields.descriptionLabel')} name="description">
          <Input.TextArea rows={3} placeholder={t('settings.departments.descriptionPlaceholder')} />
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
