import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Switch,
  TreeSelect,
  type MenuProps,
  type TableProps,
  type TreeSelectProps,
} from 'antd';
import {
  ApartmentOutlined,
  IdcardOutlined,
  MoreOutlined,
  PlusOutlined,
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { foldDonutSlices } from '@/components/charts/donutSlices';
import { DepartmentOrgChart } from '@/components/departments/DepartmentOrgChart';
import { BooleanTag } from '@/components/crud/BooleanTag';
import { CrudFormModal } from '@/components/crud/CrudFormModal';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { GeneratedCodeField } from '@/components/crud/GeneratedCodeField';
import { RowActions } from '@/components/crud/RowActions';
import { TableSearch } from '@/components/crud/TableSearch';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import { useCrudScreen } from '@/hooks/useCrudScreen';
import { useAllDepartments, useDepartments } from '@/hooks/useDepartments';
import { useEmployeeSearch } from '@/hooks/useEmployeeSearch';
import { parseBoolParam, parseEnumParam, useTableQuery } from '@/hooks/useTableQuery';
import type { EmployeePickerItem } from '@/types/employee.types';
import {
  DEPARTMENT_NAME_MAX_LENGTH,
  DEPARTMENT_SORT_KEYS,
  MAX_SORT_ORDER,
  type Department,
  type DepartmentPayload,
  type DepartmentSortKey,
  type DepartmentTreeNode,
  type SortOrder,
} from '@/types/masterData.types';
import { collectSubtreeIds, flattenDepartmentTree } from '@/utils/departmentTree';
import { formatNumber, formatPercent } from '@/utils/format';
import styles from './DepartmentsPage.module.css';

/**
 * `/settings/departments` — the company's department hierarchy.
 *
 * The screen reads TWO endpoints and each answers a different question:
 *   - `GET /departments` (paginated) backs the list card: search, status filter,
 *     sorting and `?page=` all belong to it.
 *   - `GET /departments/tree` backs everything that describes the WHOLE company —
 *     the KPI row, the org chart and the headcount donut. It ignores pagination
 *     and filters, which is exactly right for those three: a summary that changed
 *     when you typed in the search box would be a summary of nothing. It is also
 *     the same cache entry the parent-department picker reads, so opening the form
 *     modal costs no extra request.
 *
 * WHAT THIS SCREEN DOES NOT SHOW, and why. The design it was built from also asked
 * for a monthly personnel budget, a performance percentage, a count of open
 * vacancies and "+2 vs last month" deltas on every KPI. None of those exist:
 * `departments` has no budget column, performance reviews are per-employee and
 * belong to Giai đoạn 7, there is no recruitment/vacancy concept anywhere in the
 * schema, and nothing keeps historical snapshots to compare a month against. They
 * are omitted rather than filled with plausible numbers — a real figure standing
 * next to an invented one makes both untrustworthy. The two KPI slots freed up
 * became "Tổng nhân sự" (sum of `employeeCount`) and "Chức vụ" (sum of
 * `positionCount`), and the vacancy column became `positionCount` per department.
 *
 * MANAGER FIELD: `managerId` is an `employees.id`, and no one can remember an id,
 * so the field is a searchable picker over `GET /employees`. That endpoint is
 * young — no automated tests, and it may yet be withdrawn — so it is reached
 * through exactly one hook (`useEmployeeSearch`) and the field falls back to a
 * plain id input, with an inline explanation, whenever the request fails.
 *
 * CODE FIELD: there isn't one. The server generates `PB0001`, `PB0002`… and never
 * accepts a code, so the form does not collect it; the list shows it under the
 * department name and the edit modal shows it as read-only context.
 */

interface DepartmentFormValues {
  name: string;
  parentId?: number | null;
  managerId?: number | null;
  sortOrder?: number;
  description?: string;
  isActive: boolean;
}

/**
 * The sort dropdown's options, as `sort:order` pairs. Only combinations the
 * backend accepts (`DEPARTMENT_SORT_KEYS`) are offered, and the chosen pair goes
 * into the URL through the same `setSorter` the column headers use — so the
 * dropdown, the headers and a deep-linked `?sort=` can never disagree.
 */
const SORT_OPTIONS: ReadonlyArray<{ sort: DepartmentSortKey; order: SortOrder; labelKey: string }> =
  [
    { sort: 'sortOrder', order: 'asc', labelKey: 'settings.departments.sortManual' },
    { sort: 'name', order: 'asc', labelKey: 'settings.departments.sortNameAsc' },
    { sort: 'name', order: 'desc', labelKey: 'settings.departments.sortNameDesc' },
    { sort: 'code', order: 'asc', labelKey: 'settings.departments.sortCode' },
    { sort: 'createdAt', order: 'desc', labelKey: 'settings.departments.sortNewest' },
  ];

/** Largest department first — the donut's reading order. */
const byHeadcountDesc = (a: Department, b: Department) => b.employeeCount - a.employeeCount;

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

/**
 * A type alias, not an interface: AntD constrains `Select`'s option generic to
 * `BaseOptionType`, which has an index signature, and only type aliases get the
 * implicit index signature that makes them assignable to it.
 */
type ManagerOption = {
  value: number;
  label: string;
};

/**
 * One row of the manager dropdown.
 *
 * The employee code is always shown and the department whenever the payload
 * carries one: two colleagues can share a name, and "Nguyễn Văn An" twice over is
 * exactly the situation this picker exists to fix.
 */
function toManagerOption(employee: EmployeePickerItem, t: TFunction): ManagerOption {
  return {
    value: employee.id,
    label: employee.department
      ? t('settings.departments.managerOptionWithDepartment', {
          name: employee.fullName,
          code: employee.employeeCode,
          department: employee.department.name,
        })
      : t('settings.departments.managerOption', {
          name: employee.fullName,
          code: employee.employeeCode,
        }),
  };
}

export function DepartmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canWrite = useCanWriteMasterData();
  const table = useTableQuery({ sort: 'sortOrder', order: 'asc', pageSize: 10 });
  const [form] = Form.useForm<DepartmentFormValues>();
  const [orgExpanded, setOrgExpanded] = useState(false);

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

  const list = useDepartments(listFilters);
  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;

  /**
   * The whole hierarchy, always loaded: it feeds the KPI row, the org chart and
   * the donut, and (through the same cache key) the parent picker in the modal.
   */
  const company = useAllDepartments();
  const companyNodes = useMemo(
    () => flattenDepartmentTree(company.tree),
    [company.tree],
  );

  const screen = useCrudScreen<Department, DepartmentPayload>({
    resource: list,
    entityName: t('settings.departments.entity'),
    rowTitle: (row) => row.name,
  });

  /** Every KPI below is a plain sum or count over `companyNodes` — no estimates. */
  const summary = useMemo(() => {
    const departments = companyNodes.map((entry) => entry.node);
    const count = departments.length;
    const roots = companyNodes.filter((entry) => entry.depth === 0).length;
    const withManager = departments.filter((department) => department.manager !== null).length;
    const employees = departments.reduce((sum, department) => sum + department.employeeCount, 0);
    const positions = departments.reduce((sum, department) => sum + department.positionCount, 0);

    return {
      count,
      roots,
      children: count - roots,
      withManager,
      withoutManager: count - withManager,
      employees,
      averageEmployees: count > 0 ? employees / count : 0,
      positions,
      withoutPositions: departments.filter((department) => department.positionCount === 0).length,
    };
  }, [companyNodes]);

  /** Donut slices: departments by headcount, largest first, tail folded to "Khác". */
  const donutSlices = useMemo(() => {
    const ordered = companyNodes
      .map((entry) => entry.node)
      .filter((department) => department.employeeCount > 0)
      .sort(byHeadcountDesc);
    return foldDonutSlices(
      ordered.map((department) => ({
        key: String(department.id),
        label: department.name,
        value: department.employeeCount,
      })),
      t('settings.departments.donutOther'),
    );
  }, [companyNodes, t]);

  const excludedParents = useMemo(
    () => (screen.editing ? collectSubtreeIds(company.tree, screen.editing.id) : new Set<number>()),
    [company.tree, screen.editing],
  );
  const parentOptions = useMemo(
    () => toParentOptions(company.tree, excludedParents),
    [company.tree, excludedParents],
  );

  /**
   * Manager picker. Only queried while the modal is open, and `isError` is what
   * makes the field degrade instead of hanging — see the form field below.
   */
  const employeeSearch = useEmployeeSearch({ enabled: screen.isModalOpen });
  const selectedManagerId = Form.useWatch('managerId', form);

  /**
   * The dropdown lists the current search results — plus, when it is missing from
   * them, whoever is currently selected. `filterOption={false}` means the Select
   * renders the label of the option matching its value and nothing else, so
   * without this the already-assigned manager (and anyone picked under an earlier
   * search term) would collapse to a bare id in the closed field.
   *
   * Label sources, in order: a search result → the same person remembered from an
   * earlier result → `manager.fullName` from the department row itself, which is
   * all `GET /departments` returns (`manager: { id, fullName }`, no code).
   */
  const managerOptions = useMemo(() => {
    const options = employeeSearch.results.map((employee) => toManagerOption(employee, t));

    if (typeof selectedManagerId !== 'number') {
      return options;
    }
    if (options.some((option) => option.value === selectedManagerId)) {
      return options;
    }

    const remembered = employeeSearch.known[selectedManagerId];
    if (remembered) {
      return [toManagerOption(remembered, t), ...options];
    }
    const assigned = screen.editing?.manager;
    if (assigned?.id === selectedManagerId) {
      return [{ value: assigned.id, label: assigned.fullName }, ...options];
    }
    return options;
  }, [employeeSearch.known, employeeSearch.results, screen.editing, selectedManagerId, t]);

  const columns: TableProps<Department>['columns'] = [
    {
      title: t('settings.departments.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string, row) => (
        <div className={styles.deptCell}>
          <span className={styles.deptTile} aria-hidden="true">
            <ApartmentOutlined />
          </span>
          <div className={styles.deptBody}>
            <span className={styles.deptName} title={name}>
              {name}
            </span>
            <span className={styles.deptCode}>{row.code}</span>
          </div>
        </div>
      ),
    },
    {
      title: t('settings.departments.manager'),
      key: 'manager',
      width: 190,
      render: (_value, row) =>
        row.manager ? (
          <span className={styles.managerCell}>
            <Avatar size={24} className={styles.managerAvatar} icon={<UserOutlined />} />
            <span className={styles.managerName} title={row.manager.fullName}>
              {row.manager.fullName}
            </span>
          </span>
        ) : (
          <span className={styles.muted}>{t('settings.departments.noManager')}</span>
        ),
    },
    {
      title: t('settings.departments.employeeCount'),
      dataIndex: 'employeeCount',
      key: 'employeeCount',
      width: 110,
      align: 'right',
      render: (value: number) => <span className={styles.numberCell}>{formatNumber(value)}</span>,
    },
    {
      title: t('settings.departments.positionCount'),
      dataIndex: 'positionCount',
      key: 'positionCount',
      width: 110,
      align: 'right',
      render: (value: number) => <span className={styles.numberCell}>{formatNumber(value)}</span>,
    },
    {
      title: t('settings.fields.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 140,
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
      width: 72,
      align: 'center',
      fixed: 'right',
      render: (_value, row) => (
        <RowActions
          variant="menu"
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

  /** The `⋮` next to the filters: the two things this card can do to itself. */
  const listMenuItems: MenuProps['items'] = [
    { key: 'refresh', label: t('common.refresh') },
    {
      key: 'clearFilters',
      label: t('crud.clearFilters'),
      disabled: !hasFilters,
    },
  ];

  const onListMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'refresh') {
      list.refetch();
      company.refetch();
      return;
    }
    table.setFilter('search', undefined);
    table.setFilter('isActive', undefined);
  };

  /**
   * `undefined` when the URL names a sort the dropdown does not offer (a hand-
   * edited `?sort=code&order=desc`, or a column header click on a key with no
   * preset). The Select then shows its placeholder rather than pretending the
   * table is sorted some other way — the table itself still honours the URL.
   */
  const activeSortValue = SORT_OPTIONS.some(
    (option) => option.sort === listFilters.sort && option.order === listFilters.order,
  )
    ? `${listFilters.sort}:${listFilters.order}`
    : undefined;

  const initialValues: Partial<DepartmentFormValues> = screen.editing
    ? {
        name: screen.editing.name,
        parentId: screen.editing.parentId ?? undefined,
        managerId: screen.editing.manager?.id ?? undefined,
        sortOrder: screen.editing.sortOrder,
        description: screen.editing.description ?? undefined,
        isActive: screen.editing.isActive,
      }
    : { isActive: true, sortOrder: 0 };

  const handleSubmit = (values: DepartmentFormValues) => {
    // No `code`: the server owns it and the API strips one that is sent anyway.
    void screen.submit({
      name: values.name.trim(),
      // `null` clears the link server-side; `undefined` would leave it unchanged.
      parentId: values.parentId ?? null,
      managerId: values.managerId ?? null,
      sortOrder: values.sortOrder ?? 0,
      description: values.description?.trim() ? values.description.trim() : null,
      isActive: values.isActive,
    });
  };

  /**
   * The KPI row, the org chart and the donut are all views of ONE request, so a
   * failure is reported ONCE: a single inline `Alert` with "Thử lại" replaces all
   * three, and the list card beside it keeps working (§7). Never a toast, and
   * never three copies of the same sentence (§8 "KHÔNG thông báo trùng").
   */
  const treeFailed = company.isError;

  return (
    <>
      <PageHeader
        title={t('settings.departments.pageTitle')}
        subtitle={t('settings.departments.subtitle')}
        actions={
          <>
            <Button icon={<TeamOutlined />} onClick={() => void navigate('/employees')}>
              {t('settings.departments.viewEmployees')}
            </Button>
            {addButton}
          </>
        }
      />

      <div className={styles.page}>
        {treeFailed ? (
          <Alert
            type="warning"
            showIcon
            role="alert"
            message={t('settings.departments.loadTreeError')}
            action={
              <Button size="small" onClick={company.refetch}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : company.isLoading ? (
          <div className={styles.kpiRow}>
            {[0, 1, 2, 3].map((slot) => (
              <div key={slot} className={styles.kpiSkeleton}>
                <Skeleton active title={false} paragraph={{ rows: 2 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.kpiRow}>
            <StatCard
              tone="blue"
              icon={<ApartmentOutlined />}
              label={t('settings.departments.kpiTotal')}
              hint={t('settings.departments.kpiTotalHint')}
              value={formatNumber(summary.count)}
              caption={t('settings.departments.kpiTotalCaption', {
                roots: summary.roots,
                children: summary.children,
              })}
            />
            <StatCard
              tone="teal"
              icon={<IdcardOutlined />}
              label={t('settings.departments.kpiManagers')}
              hint={t('settings.departments.kpiManagersHint')}
              value={formatNumber(summary.withManager)}
              caption={
                summary.withoutManager > 0
                  ? t('settings.departments.kpiManagersCaption', {
                      count: summary.withoutManager,
                    })
                  : t('settings.departments.kpiManagersCaptionAll')
              }
            />
            <StatCard
              tone="purple"
              icon={<TeamOutlined />}
              label={t('settings.departments.kpiEmployees')}
              hint={t('settings.departments.kpiEmployeesHint')}
              value={formatNumber(summary.employees)}
              caption={
                summary.count > 0
                  ? t('settings.departments.kpiEmployeesCaption', {
                      value: formatNumber(summary.averageEmployees),
                    })
                  : null
              }
            />
            <StatCard
              tone="green"
              icon={<ProfileOutlined />}
              label={t('settings.departments.kpiPositions')}
              hint={t('settings.departments.kpiPositionsHint')}
              value={formatNumber(summary.positions)}
              caption={
                summary.withoutPositions > 0
                  ? t('settings.departments.kpiPositionsCaption', {
                      count: summary.withoutPositions,
                    })
                  : t('settings.departments.kpiPositionsCaptionAll')
              }
            />
          </div>
        )}

        {/* With no tree there is no rail, so the list takes the full width. */}
        <div className={treeFailed ? styles.bodyFull : styles.body}>
          <div className={styles.main}>
            <DataTableCard<Department>
              className={styles.listCard}
              title={t('settings.departments.listTitle')}
              columns={columns}
              rows={rows}
              isLoading={list.isLoading}
              isRefreshing={list.isFetching && !list.isLoading}
              isError={list.isError}
              onRetry={list.refetch}
              errorMessage={t('settings.departments.loadError')}
              total={total}
              showCount={false}
              hasFilters={hasFilters}
              emptyAction={addButton}
              scrollX={720}
              filters={
                <>
                  <TableSearch
                    /*
                     * The input is uncontrolled (the URL is the source of truth),
                     * so "Xóa bộ lọc" in the `⋮` menu would otherwise clear the
                     * param and leave the old text sitting in the box. Keying on
                     * empty-vs-filled remounts it exactly when that happens, and
                     * not on every keystroke.
                     */
                    key={search ? 'filled' : 'empty'}
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
                  <Select<string>
                    className={styles.filterSelect}
                    value={activeSortValue}
                    placeholder={t('settings.departments.sortLabel')}
                    onChange={(value) => {
                      const [sort, order] = value.split(':');
                      table.setSorter(sort, order as SortOrder);
                    }}
                    aria-label={t('settings.departments.sortLabel')}
                    options={SORT_OPTIONS.map((option) => ({
                      value: `${option.sort}:${option.order}`,
                      label: t('settings.departments.sortPrefix', { value: t(option.labelKey) }),
                    }))}
                  />
                  <Dropdown
                    trigger={['click']}
                    menu={{ items: listMenuItems, onClick: onListMenuClick }}
                  >
                    <Button
                      type="text"
                      icon={<MoreOutlined />}
                      aria-label={t('settings.departments.listOptions')}
                    />
                  </Dropdown>
                </>
              }
              pagination={{
                page: table.page,
                pageSize: table.pageSize,
                total,
                onChange: table.setPagination,
                showTotal: (value, range) =>
                  t('settings.departments.showingRange', {
                    from: range[0],
                    to: range[1],
                    total: value,
                  }),
              }}
              onSorterChange={table.setSorter}
              activeSort={{ key: listFilters.sort, order: listFilters.order }}
            />
          </div>

          {!treeFailed && (
            <div className={styles.side}>
              <Card
                variant="borderless"
                title={t('settings.departments.orgTitle')}
                extra={
                  company.tree && company.tree.length > 0 ? (
                    <Button
                      type="link"
                      className={styles.cardLink}
                      onClick={() => setOrgExpanded((value) => !value)}
                    >
                      {orgExpanded
                        ? t('settings.departments.orgCollapse')
                        : t('settings.departments.orgViewAll')}
                    </Button>
                  ) : null
                }
              >
                {company.isLoading ? (
                  <Skeleton active title={false} paragraph={{ rows: 5 }} />
                ) : (
                  <DepartmentOrgChart
                    roots={company.tree ?? []}
                    expanded={orgExpanded}
                    emptyText={t('common.noData')}
                  />
                )}
              </Card>

              <Card variant="borderless" title={t('settings.departments.donutTitle')}>
                {company.isLoading ? (
                  <Skeleton active title={false} paragraph={{ rows: 5 }} />
                ) : (
                  <DonutChart
                    slices={donutSlices}
                    total={summary.employees}
                    centerLabel={t('settings.departments.donutCenterLabel')}
                    centerCaption={t('settings.departments.donutCenterCaption')}
                    figureLabel={t('settings.departments.donutTitle')}
                    formatSliceValue={(value, percent) =>
                      t('settings.departments.donutLegendValue', {
                        count: value,
                        percent: formatPercent(percent),
                      })
                    }
                    emptyText={t('settings.departments.donutEmpty')}
                  />
                )}
              </Card>
            </div>
          )}
        </div>
      </div>

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
        {screen.editing && <GeneratedCodeField code={screen.editing.code} />}

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
          Pick a person, don't type their id.

          `showSearch` + `filterOption={false}` because the filtering happens on
          the server (`?search=`, debounced 300ms inside the hook) — the client
          must not also filter the 20 rows it was handed. `allowClear` because a
          department is allowed to have no manager.

          When `/employees` is unreachable the field degrades to what it used to
          be — a plain employee-id input — and says so in `extra`. That keeps the
          rest of the form saveable (name, parent, sort order, status) instead of
          holding a whole department hostage to one dropdown, and it is why
          `EMPLOYEE_NOT_FOUND` is still mapped: a hand-typed or stale id can miss.

          Only the Select carries an `aria-label`; the fallback input does not,
          because `Form.Item` already ties it to its own visible label and an
          `aria-label` would override that with different words (WCAG 2.5.3
          "Label in Name").
        */}
        {employeeSearch.isError ? (
          <Form.Item
            label={t('settings.departments.managerIdLabel')}
            name="managerId"
            extra={t('settings.departments.managerUnavailable')}
          >
            <InputNumber
              className={styles.fullWidth}
              min={1}
              step={1}
              precision={0}
              placeholder={t('settings.departments.managerIdPlaceholder')}
            />
          </Form.Item>
        ) : (
          <Form.Item
            label={t('settings.departments.managerLabel')}
            name="managerId"
            extra={t('settings.departments.managerHint')}
          >
            <Select<number, ManagerOption>
              showSearch
              allowClear
              // Server-side search: never let AntD filter the results as well.
              filterOption={false}
              loading={employeeSearch.isSearching}
              onSearch={employeeSearch.onSearch}
              options={managerOptions}
              placeholder={t('settings.departments.managerPlaceholder')}
              aria-label={t('settings.departments.manager')}
              // §7: "searching" and "nothing matched" are different answers.
              notFoundContent={
                employeeSearch.isSearching
                  ? t('settings.departments.managerSearching')
                  : t('settings.departments.managerNoResults')
              }
            />
          </Form.Item>
        )}

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
