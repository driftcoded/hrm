import type { ReactNode } from 'react';
import { Alert, Button, Card, Empty, Skeleton, Table } from 'antd';
import type { TableProps } from 'antd';
import { FileSearchOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_OPTIONS } from '@/hooks/useTableQuery';
import type { SortOrder } from '@/types/masterData.types';
import styles from './DataTableCard.module.css';

/**
 * The list-screen shell every Settings page renders: filter bar, action bar with
 * the record count, the table itself, pagination, and the loading / empty /
 * error states from docs/ui-conventions.md §5 and §7.
 *
 * It takes no hooks and makes no API calls (frontend/CLAUDE.md folder rule) —
 * the page owns the data and passes it in. That is what keeps five very different
 * tables (a tree, three paginated lists and one unpaginated array) on one
 * consistent frame without a generic "CRUD engine" deciding what a screen looks
 * like.
 *
 * States, in the order they are checked:
 *   - error   -> inline `Alert` + "Thử lại" (§7). NEVER a toast: the error has a
 *                place on screen, so that place is the only one (§8).
 *   - first
 *     paint   -> `Skeleton` (§7 "Tải trang lần đầu"), no page-level `Spin`.
 *   - refetch -> `Table loading` so the rows dim in place instead of collapsing.
 *   - empty   -> different copy for "nothing created yet" vs "no match for your
 *                filters", because the useful next action differs.
 */

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
}

export interface DataTableCardProps<TRow> {
  columns: TableProps<TRow>['columns'];
  rows: TRow[];
  /** Defaults to `id`. */
  rowKey?: string;
  /** First load with no cached data — renders a Skeleton. */
  isLoading: boolean;
  /** Background refetch — dims the existing rows. */
  isRefreshing?: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Message shown when the list fails to load. */
  errorMessage: string;
  /** Left side of the toolbar. */
  filters?: ReactNode;
  /** Right side of the toolbar (typically the "Thêm mới" button). */
  actions?: ReactNode;
  /** `undefined` for unpaginated endpoints; the count still shows in the bar. */
  pagination?: DataTablePagination;
  /** Total records — shown in the action bar even when there is no pagination. */
  total: number;
  onSorterChange?: (sort: string | undefined, order: SortOrder | undefined) => void;
  /**
   * The sort currently in the URL. Passing it makes the Table's sorter
   * CONTROLLED, which matters for two reasons: the arrow shown matches a
   * deep-linked `?sort=`, and AntD stops reporting its own (empty) sorter state
   * on the next pagination click — which would otherwise wipe the sort params.
   */
  activeSort?: { key?: string; order?: SortOrder };
  /** Drives the empty-state copy: filtered-but-no-match vs nothing-created-yet. */
  hasFilters?: boolean;
  /** Offered inside the empty state when the user may create records (§5). */
  emptyAction?: ReactNode;
  expandable?: TableProps<TRow>['expandable'];
  /** Horizontal scroll width for wide tables (§10). */
  scrollX?: number;
}

/** AntD reports `'ascend' | 'descend' | null`; the API wants `asc` / `desc`. */
function toApiOrder(order: string | null | undefined): SortOrder | undefined {
  if (order === 'ascend') {
    return 'asc';
  }
  if (order === 'descend') {
    return 'desc';
  }
  return undefined;
}

export function DataTableCard<TRow extends object>({
  columns,
  rows,
  rowKey = 'id',
  isLoading,
  isRefreshing = false,
  isError,
  onRetry,
  errorMessage,
  filters,
  actions,
  pagination,
  total,
  onSorterChange,
  activeSort,
  hasFilters = false,
  emptyAction,
  expandable,
  scrollX,
}: DataTableCardProps<TRow>) {
  const { t } = useTranslation();

  /**
   * Reflect the URL's sort onto whichever sortable column it names, and clear the
   * arrow on all the others.
   */
  const resolvedColumns = activeSort
    ? columns?.map((column) => {
        if (!('sorter' in column) || !column.sorter) {
          return column;
        }
        const key = 'key' in column ? column.key : undefined;
        const isActive = key !== undefined && String(key) === activeSort.key;
        return {
          ...column,
          sortOrder: isActive
            ? activeSort.order === 'desc'
              ? ('descend' as const)
              : ('ascend' as const)
            : null,
        };
      })
    : columns;

  const toolbar = (
    <div className={styles.toolbar}>
      <div className={styles.filters}>{filters}</div>
      <div className={styles.actions}>
        <span className={styles.count}>{t('crud.totalRecords', { total })}</span>
        {actions}
      </div>
    </div>
  );

  if (isError) {
    return (
      <Card variant="borderless">
        {toolbar}
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          role="alert"
          action={
            <Button size="small" onClick={onRetry}>
              {t('common.retry')}
            </Button>
          }
        />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card variant="borderless">
        {toolbar}
        <Skeleton active title={false} paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  const emptyText = (
    <div className={styles.empty}>
      <Empty
        image={hasFilters ? <FileSearchOutlined /> : <InboxOutlined />}
        description={hasFilters ? t('crud.noResults') : t('common.noData')}
      >
        {!hasFilters && emptyAction}
      </Empty>
    </div>
  );

  return (
    <Card variant="borderless">
      {toolbar}
      <Table<TRow>
        columns={resolvedColumns}
        dataSource={rows}
        rowKey={rowKey}
        size="middle"
        loading={isRefreshing}
        locale={{ emptyText }}
        expandable={expandable}
        scroll={scrollX ? { x: scrollX } : undefined}
        onChange={(_pagination, _filters, sorter) => {
          if (!onSorterChange || Array.isArray(sorter)) {
            return;
          }
          const key = sorter.columnKey ?? sorter.field;
          const order = toApiOrder(sorter.order);
          onSorterChange(order && typeof key === 'string' ? key : undefined, order);
        }}
        pagination={
          pagination
            ? {
                current: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
                showTotal: (value) => t('crud.totalRecords', { total: value }),
                onChange: pagination.onChange,
              }
            : false
        }
      />
    </Card>
  );
}
