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
  /**
   * Replaces the default "Tổng N bản ghi" in the pager. `/settings/departments`
   * shows the visible range instead ("Hiển thị 1 đến 8 trong tổng số 12 phòng
   * ban"), which is the only footer text its layout has room for.
   */
  showTotal?: (total: number, range: [number, number]) => ReactNode;
}

export interface DataTableCardProps<TRow> {
  columns: TableProps<TRow>['columns'];
  rows: TRow[];
  /** Card heading above the toolbar, e.g. "Danh sách phòng ban". */
  title?: ReactNode;
  /** Extra class on the `Card`, for screen-specific layout tweaks. */
  className?: string;
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
  /**
   * Checkbox column for bulk actions. Optional because most list screens have
   * none — passing it in keeps the selection state with the page that owns the
   * bulk operations, rather than hiding it inside this shell.
   */
  rowSelection?: TableProps<TRow>['rowSelection'];
  /**
   * Replaces the default "Tổng N bản ghi" text in the toolbar. The employee
   * list shows how many rows are SELECTED there instead, so it needs to say
   * something else without losing the rest of the frame.
   */
  countSlot?: ReactNode;
  /**
   * Set to `false` when the count already appears somewhere else on the card, so
   * the same number is not printed twice. `/settings/departments` puts the range
   * summary in the footer and needs the toolbar free for its filters.
   */
  showCount?: boolean;
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
  title,
  className,
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
  rowSelection,
  countSlot,
  showCount = true,
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

  const count = showCount ? (
    <span className={styles.count}>{t('crud.totalRecords', { total })}</span>
  ) : null;
  const countNode = countSlot ?? count;

  // Không có bộ lọc, hành động lẫn số đếm thì bỏ hẳn thanh công cụ — giữ lại
  // chỉ để lại một hàng rỗng có margin, đẩy bảng xuống không vì gì cả.
  const toolbar = (
    <>
      {title && <h2 className={styles.title}>{title}</h2>}
      {(filters || actions || countNode) && (
        <div className={styles.toolbar}>
          <div className={styles.filters}>{filters}</div>
          <div className={styles.actions}>
            {countNode}
            {actions}
          </div>
        </div>
      )}
    </>
  );

  if (isError) {
    return (
      <Card variant="borderless" className={className}>
        {toolbar}
        <Alert
          type="error"
          showIcon
          title={errorMessage}
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
      <Card variant="borderless" className={className}>
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
    <Card variant="borderless" className={className}>
      {toolbar}
      <Table<TRow>
        columns={resolvedColumns}
        dataSource={rows}
        rowKey={rowKey}
        size="middle"
        loading={isRefreshing}
        locale={{ emptyText }}
        expandable={expandable}
        rowSelection={rowSelection}
        scroll={scrollX ? { x: scrollX } : undefined}
        onChange={(_pagination, _filters, sorter, extra) => {
          // ONLY react to a real sort. AntD fires this handler for pagination and
          // filter changes too, with the *current* sorter echoed back — and acting
          // on that was a live bug: changing the page size fired two URL updates
          // in the same tick (pagination wrote page+pageSize, this handler then
          // rewrote sort/order), and the second one computed its params from the
          // pre-navigation location, silently dropping pageSize. The selector then
          // snapped back to the default 20. See the note in hooks/useTableQuery.
          if (extra.action !== 'sort' || !onSorterChange || Array.isArray(sorter)) {
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
                // AntD v6 builds the size changer with `showSearch: true`, which
                // puts a text box inside a dropdown of four fixed options. These
                // SelectProps are spread after that default, so this turns it off
                // and leaves a plain select.
                showSizeChanger: { showSearch: false },
                pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
                showTotal:
                  pagination.showTotal ??
                  ((value) => t('crud.totalRecords', { total: value })),
                onChange: pagination.onChange,
              }
            : false
        }
      />
    </Card>
  );
}
