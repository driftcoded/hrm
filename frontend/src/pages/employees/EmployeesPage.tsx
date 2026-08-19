import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  type TableProps,
} from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  FileProtectOutlined,
  FilterOutlined,
  MailOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SolutionOutlined,
  SwapOutlined,
  TeamOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { TableSearch } from '@/components/crud/TableSearch';
import { DeleteEmployeeModal } from '@/components/employees/DeleteEmployeeModal';
import { EmployeeStatusTag } from '@/components/employees/EmployeeStatusTag';
import { EmployeeWizard } from '@/components/employees/EmployeeWizard';
import { OverviewRail } from '@/components/employees/OverviewRail';
import { StatTile } from '@/components/employees/StatTile';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAllDepartments } from '@/hooks/useDepartments';
import { useEmployees, useEmployeeMutations, useEmployeeStats } from '@/hooks/useEmployees';
import { usePositions } from '@/hooks/usePositions';
import { useCanDeleteEmployees, useCanCreateUsers, useCanWriteEmployees } from '@/hooks/usePermissions';
import {
  parseBoolParam,
  parseEnumParam,
  parseIntParam,
  useTableQuery,
} from '@/hooks/useTableQuery';
import { createContract, createUser } from '@/services/employee.service';
import {
  EMPLOYEE_SORT_KEYS,
  EMPLOYEE_STATUSES,
  GENDERS,
  type EmployeeListItem,
  type EmployeeSortKey,
  type EmployeeStatus,
  type Gender,
} from '@/types/employee.types';
import { flattenDepartmentTree } from '@/utils/departmentTree';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import styles from './EmployeesPage.module.css';

const { Text } = Typography;

/**
 * `/employees` — the module's list screen.
 *
 * Layout, top to bottom: page header + primary action, one filter bar, four
 * overview tiles, then the table with a context rail beside it. On tablet the
 * rail moves BELOW the table rather than squeezing it (see the module CSS §10).
 *
 * URL IS THE STATE. Page, page size, sort and every filter live in the query
 * string through `useTableQuery`, so F5 and a shared link land on the same rows.
 * That hook's page-reset rule applies here too: changing a filter's VALUE
 * returns to page 1 (page 7 of the old result set may not exist), while
 * re-applying the same filter, sorting or paginating leaves the page alone.
 *
 * FEATURES THAT DO NOT EXIST YET are shown disabled with a "sắp có" tooltip
 * rather than omitted or, worse, wired to nothing: bulk email, Excel export and
 * bulk department change have no endpoint in any phase yet. The same convention
 * the sidebar already uses for upcoming modules.
 */

/** How many rows a selection has to reach before the bulk bar means anything. */
const BULK_ACTIONS = [
  { key: 'email', icon: <MailOutlined />, labelKey: 'employees.bulk.email' },
  { key: 'export', icon: <ExportOutlined />, labelKey: 'employees.bulk.export' },
  { key: 'department', icon: <SwapOutlined />, labelKey: 'employees.bulk.department' },
] as const;

export function EmployeesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canWrite = useCanWriteEmployees();
  const canDelete = useCanDeleteEmployees();
  const canCreateAccount = useCanCreateUsers();

  const table = useTableQuery({ sort: 'employeeCode', order: 'asc' });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isWizardOpen, setWizardOpen] = useState(false);
  const [deleting, setDeleting] = useState<EmployeeListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ------------------------------------------------------------ filters ---

  const search = table.filters.search;
  const departmentId = parseIntParam(table.filters.departmentId);
  const positionId = parseIntParam(table.filters.positionId);
  const status = parseEnumParam<EmployeeStatus>(table.filters.status, EMPLOYEE_STATUSES);
  const gender = parseEnumParam<Gender>(table.filters.gender, GENDERS);
  const hireFrom = table.filters.hireFrom;
  const hireTo = table.filters.hireTo;
  const onlyDeleted = parseBoolParam(table.filters.onlyDeleted) === true;

  const hasFilters =
    Boolean(search) ||
    departmentId !== undefined ||
    positionId !== undefined ||
    status !== undefined ||
    gender !== undefined ||
    Boolean(hireFrom) ||
    Boolean(hireTo) ||
    onlyDeleted;

  const filters = {
    page: table.page,
    limit: table.pageSize,
    sort: parseEnumParam<EmployeeSortKey>(table.sort, EMPLOYEE_SORT_KEYS) ?? 'employeeCode',
    order: table.order ?? ('asc' as const),
    search,
    departmentId,
    positionId,
    status,
    gender,
    hireFrom,
    hireTo,
    onlyDeleted: onlyDeleted ? true : undefined,
  };

  const list = useEmployees(filters);
  const stats = useEmployeeStats();
  const mutations = useEmployeeMutations();

  const { tree: departmentTree } = useAllDepartments();
  const departments = useMemo(() => flattenDepartmentTree(departmentTree), [departmentTree]);

  // Position options follow the department filter, exactly like the wizard.
  const positionsResource = usePositions({
    departmentId,
    isActive: true,
    limit: 100,
  });
  const positions = positionsResource.data?.items ?? [];

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;

  const resetFilters = () => {
    for (const key of [
      'search',
      'departmentId',
      'positionId',
      'status',
      'gender',
      'hireFrom',
      'hireTo',
      'onlyDeleted',
    ]) {
      table.setFilter(key, undefined);
    }
    setSelectedIds([]);
  };

  // ------------------------------------------------------------- writes ---

  /**
   * Create the employee, then optionally the contract and the account.
   *
   * Sequential and NOT atomic — there is no transactional endpoint spanning the
   * three, so the wizard is told exactly which part failed and the employee it
   * did create is kept. Reporting "failed" and leaving an orphan record would be
   * worse than saying what actually happened.
   */
  const handleWizardSubmit: React.ComponentProps<typeof EmployeeWizard>['onSubmit'] = async ({
    employee,
    contract,
    account,
  }) => {
    const created = await mutations.createEmployee(employee);

    if (contract) {
      try {
        await createContract({ ...contract, employeeId: created.id });
      } catch (error) {
        return {
          employeeId: created.id,
          employeeCode: created.employeeCode,
          partialError: t('employees.wizard.contractFailed', {
            code: created.employeeCode,
            reason: resolveError(error),
          }),
        };
      }
    }

    if (account) {
      try {
        await createUser({ ...account, employeeId: created.id });
      } catch (error) {
        return {
          employeeId: created.id,
          employeeCode: created.employeeCode,
          partialError: t('employees.wizard.accountFailed', {
            code: created.employeeCode,
            reason: resolveError(error),
          }),
        };
      }
    }

    setWizardOpen(false);
    // The modal has closed, so a toast is the only surface left (§8).
    message.success(t('employees.wizard.created', { code: created.employeeCode }));
    list.refetch();

    return { employeeId: created.id, employeeCode: created.employeeCode, partialError: null };
  };

  /**
   * Record WHY first, then soft-delete.
   *
   * If the PATCH fails the delete never runs, so a record can never end up
   * removed with the reason silently dropped. See `DeleteEmployeeModal`.
   */
  const handleDelete = (values: {
    reason: string;
    terminationType?: string;
    terminationDate: string;
  }) => {
    if (!deleting) {
      return;
    }

    void (async () => {
      setDeleteError(null);
      try {
        await mutations.updateEmployee(deleting.id, {
          terminationReason: values.reason,
          terminationDate: values.terminationDate,
          ...(values.terminationType
            ? { terminationType: values.terminationType as never }
            : {}),
        });
        await mutations.removeEmployee(deleting.id);

        setDeleting(null);
        message.success(t('employees.delete.success', { name: deleting.fullName }));
      } catch (error) {
        setDeleteError(resolveError(error));
      }
    })();
  };

  const handleRestore = (row: EmployeeListItem) => {
    modal.confirm({
      title: t('employees.restore.title'),
      content: t('employees.restore.body', { name: row.fullName }),
      okText: t('employees.restore.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await mutations.restoreEmployee(row.id);
          message.success(t('employees.restore.success', { name: row.fullName }));
        } catch (error) {
          modal.error({
            title: t('crud.deleteBlockedTitle'),
            content: resolveError(error),
            okText: t('crud.understood'),
          });
        }
      },
    });
  };

  // ------------------------------------------------------------- columns ---

  const columns: TableProps<EmployeeListItem>['columns'] = [
    {
      title: t('employees.columns.code'),
      dataIndex: 'employeeCode',
      key: 'employeeCode',
      sorter: true,
      width: 130,
      render: (code: string, row) => (
        <Button type="link" className={styles.codeLink} onClick={() => navigate(`/employees/${row.id}`)}>
          {code}
        </Button>
      ),
    },
    {
      title: t('employees.columns.name'),
      dataIndex: 'fullName',
      key: 'fullName',
      sorter: true,
      render: (fullName: string, row) => (
        <div className={styles.person}>
          {row.avatarUrl ? (
            <img src={row.avatarUrl} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              <UserOutlined />
            </span>
          )}
          <div className={styles.personBody}>
            <span className={styles.personName}>{fullName}</span>
            <span className={styles.personMeta}>{formatPhone(row.phone)}</span>
          </div>
        </div>
      ),
    },
    {
      title: t('employees.columns.department'),
      dataIndex: ['department', 'name'],
      key: 'department',
      render: (_: unknown, row) => row.department?.name ?? <Text type="secondary">—</Text>,
    },
    {
      title: t('employees.columns.position'),
      dataIndex: ['position', 'name'],
      key: 'position',
      render: (_: unknown, row) => row.position?.name ?? <Text type="secondary">—</Text>,
    },
    {
      title: t('employees.columns.status'),
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      width: 150,
      render: (value: EmployeeStatus, row) =>
        row.deletedAt ? (
          <Tag color="default" bordered={false}>
            {t('employees.status.deleted')}
          </Tag>
        ) : (
          <EmployeeStatusTag status={value} />
        ),
    },
    {
      title: t('employees.columns.hireDate'),
      dataIndex: 'hireDate',
      key: 'hireDate',
      sorter: true,
      width: 130,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('employees.columns.baseSalary'),
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      align: 'right',
      width: 150,
      render: (value: number | null) =>
        value === null ? (
          // No active contract — say so rather than printing a misleading 0 ₫.
          <Tooltip title={t('employees.columns.noContract')}>
            <Text type="secondary">—</Text>
          </Tooltip>
        ) : (
          formatCurrency(value)
        ),
    },
    {
      title: t('employees.columns.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: unknown, row) => (
        <Space size="small">
          <Tooltip title={t('employees.actions.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/employees/${row.id}`)}
              aria-label={t('employees.actions.viewAria', { name: row.fullName })}
            />
          </Tooltip>
          {row.deletedAt
            ? canDelete && (
                <Tooltip title={t('employees.restore.confirm')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => handleRestore(row)}
                    aria-label={t('employees.restore.aria', { name: row.fullName })}
                  />
                </Tooltip>
              )
            : canDelete && (
                <Tooltip title={t('common.delete')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(row);
                    }}
                    aria-label={t('crud.deleteRecordAria', { name: row.fullName })}
                  />
                </Tooltip>
              )}
        </Space>
      ),
    },
  ];

  // -------------------------------------------------------------- render ---

  const statsData = stats.data;

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('employees.title')}
        subtitle={t('employees.subtitle')}
        actions={
          <Space>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardOpen(true)}>
                {t('employees.actions.create')}
              </Button>
            )}
            <Tooltip title={t('common.comingSoon')}>
              <Button icon={<ExportOutlined />} disabled aria-label={t('employees.bulk.export')} />
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'trash',
                    icon: <DeleteOutlined />,
                    label: onlyDeleted ? t('employees.actions.exitTrash') : t('employees.actions.trash'),
                    onClick: () => table.setFilter('onlyDeleted', onlyDeleted ? undefined : 'true'),
                  },
                ],
              }}
            >
              <Button icon={<MoreOutlined />} aria-label={t('employees.actions.more')} />
            </Dropdown>
          </Space>
        }
      />

      {/* ------------------------------------------------- filter bar --- */}
      <Card variant="borderless" className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.searchBox}>
            <TableSearch
              defaultValue={search}
              placeholder={t('employees.filters.searchPlaceholder')}
              onSearch={(value) => table.setFilter('search', value || undefined)}
            />
          </div>

          <Select
            allowClear
            className={styles.filterSelect}
            placeholder={t('employees.filters.status')}
            value={status}
            onChange={(value) => table.setFilter('status', value)}
            options={EMPLOYEE_STATUSES.map((value) => ({
              value,
              label: t(`employees.status.${value}`),
            }))}
          />

          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className={styles.filterSelect}
            placeholder={t('employees.filters.department')}
            value={departmentId}
            onChange={(value) => {
              table.setFilter('departmentId', value);
              // A position only exists inside a department; keeping the old one
              // would filter to an impossible combination and show zero rows.
              table.setFilter('positionId', undefined);
            }}
            options={departments.map(({ node, depth }) => ({
              value: node.id,
              label: `${'  '.repeat(depth)}${node.name}`,
            }))}
          />

          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            className={styles.filterSelect}
            placeholder={t('employees.filters.position')}
            value={positionId}
            disabled={departmentId === undefined}
            onChange={(value) => table.setFilter('positionId', value)}
            options={positions.map((position) => ({
              value: position.id,
              label: position.name,
            }))}
          />

          <Button
            icon={<FilterOutlined />}
            type={showMoreFilters ? 'primary' : 'default'}
            ghost={showMoreFilters}
            onClick={() => setShowMoreFilters((open) => !open)}
          >
            {t('employees.filters.more')}
          </Button>

          <Button type="link" icon={<ReloadOutlined />} onClick={resetFilters} disabled={!hasFilters}>
            {t('employees.filters.reset')}
          </Button>
        </div>

        {showMoreFilters && (
          <div className={styles.filterRowSecondary}>
            <Select
              allowClear
              className={styles.filterSelect}
              placeholder={t('employees.filters.gender')}
              value={gender}
              onChange={(value) => table.setFilter('gender', value)}
              options={GENDERS.map((value) => ({
                value,
                label: t(`employees.gender.${value}`),
              }))}
            />
            <DatePicker.RangePicker
              format="DD/MM/YYYY"
              placeholder={[t('employees.filters.hireFrom'), t('employees.filters.hireTo')]}
              value={hireFrom && hireTo ? [dayjs(hireFrom), dayjs(hireTo)] : null}
              onChange={(range) => {
                table.setFilter('hireFrom', range?.[0]?.format('YYYY-MM-DD'));
                table.setFilter('hireTo', range?.[1]?.format('YYYY-MM-DD'));
              }}
            />
            {onlyDeleted && (
              <Tag color="default" closable onClose={() => table.setFilter('onlyDeleted', undefined)}>
                {t('employees.filters.trashActive')}
              </Tag>
            )}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- body --- */}
      <div className={styles.body}>
        <div className={styles.main}>
          <Row gutter={[16, 16]} className={styles.tiles}>
            <Col xs={24} sm={12} xl={6}>
              <StatTile
                tone="blue"
                icon={<TeamOutlined />}
                label={t('employees.tiles.total')}
                value={statsData ? String(statsData.total) : '—'}
                caption={
                  statsData
                    ? t('employees.tiles.hiredRecently', { count: statsData.hiredLast30Days })
                    : ''
                }
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatTile
                tone="orange"
                icon={<SolutionOutlined />}
                label={t('employees.tiles.probation')}
                value={statsData ? String(statsData.byStatus.probation) : '—'}
                caption={
                  statsData
                    ? t('employees.tiles.probationEnding', {
                        count: statsData.probationEndingSoon,
                        days: statsData.windowDays,
                      })
                    : ''
                }
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatTile
                tone="teal"
                icon={<CalendarOutlined />}
                label={t('employees.tiles.onLeave')}
                value={statsData ? String(statsData.byStatus.on_leave) : '—'}
                caption={t('employees.tiles.onLeaveCaption')}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatTile
                tone="purple"
                icon={<FileProtectOutlined />}
                label={t('employees.tiles.expiring')}
                value={statsData ? String(statsData.contractsExpiringSoon) : '—'}
                caption={
                  statsData
                    ? t('employees.tiles.expiringCaption', { days: statsData.windowDays })
                    : ''
                }
              />
            </Col>
          </Row>

          <DataTableCard<EmployeeListItem>
            columns={columns}
            rows={rows}
            isLoading={list.isLoading}
            isRefreshing={list.isFetching && !list.isLoading}
            isError={list.isError}
            onRetry={list.refetch}
            errorMessage={t('employees.loadError')}
            hasFilters={hasFilters}
            total={total}
            scrollX={1100}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys as number[]),
            }}
            countSlot={
              <span className={styles.selectionCount}>
                {t('employees.bulk.selected', { count: selectedIds.length })}
              </span>
            }
            filters={
              <Space wrap size="small">
                {BULK_ACTIONS.map((action) => (
                  <Tooltip key={action.key} title={t('common.comingSoon')}>
                    {/* Disabled, never wired to nothing — see the page note. */}
                    <Button size="small" icon={action.icon} disabled>
                      {t(action.labelKey)}
                    </Button>
                  </Tooltip>
                ))}
              </Space>
            }
            actions={
              <span className={styles.rangeText}>
                {t('employees.pagination.range', {
                  from: total === 0 ? 0 : (table.page - 1) * table.pageSize + 1,
                  to: Math.min(table.page * table.pageSize, total),
                  total,
                })}
              </span>
            }
            pagination={{
              page: table.page,
              pageSize: table.pageSize,
              total,
              onChange: table.setPagination,
            }}
            onSorterChange={table.setSorter}
            activeSort={{ key: table.sort, order: table.order }}
            emptyAction={
              canWrite ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardOpen(true)}>
                  {t('employees.actions.create')}
                </Button>
              ) : undefined
            }
          />
        </div>

        <aside className={styles.rail}>
          <OverviewRail
            stats={stats.data}
            isLoading={stats.isLoading}
            isError={stats.isError}
            onRetry={stats.refetch}
            onOpenDepartments={() => navigate('/settings/departments')}
          />
        </aside>
      </div>

      <EmployeeWizard
        open={isWizardOpen}
        onCancel={() => setWizardOpen(false)}
        onSubmit={handleWizardSubmit}
        isSaving={mutations.isSaving}
        canCreateAccount={canCreateAccount}
      />

      <DeleteEmployeeModal
        open={deleting !== null}
        employeeName={deleting?.fullName ?? ''}
        isDeleting={mutations.isDeleting || mutations.isSaving}
        error={deleteError}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
