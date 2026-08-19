import { Button, Dropdown, Space, Tooltip, type MenuProps } from 'antd';
import { DeleteOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * Edit + delete controls for a table row.
 *
 * Renders `null` for a user without write permission, so a read-only role
 * (`manager` / `employee`) that opens a Settings page by URL sees the data but no
 * controls that would 403. The backend is still the real guard — this only keeps
 * the screen honest.
 *
 * Two shapes, same behaviour:
 *   - `inline` (default) — the two icon buttons side by side. What the Settings
 *     tables with room to spare use.
 *   - `menu` — one `⋮` button opening a dropdown. Used by `/settings/departments`,
 *     whose row already carries an icon tile, a two-line name and four other
 *     columns; a second pair of icons there reads as clutter.
 *
 * Icon-only buttons carry both a `title` (tooltip) and an `aria-label` naming the
 * record, per docs/ui-conventions.md §11.
 */
export interface RowActionsProps {
  canWrite: boolean;
  /** Row name, used in the accessible label: "Sửa Phòng Tài chính". */
  recordName: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Set while a delete is in flight, to stop a double submit. */
  disabled?: boolean;
  /** `inline` = two icon buttons (default); `menu` = one `⋮` dropdown. */
  variant?: 'inline' | 'menu';
}

export function RowActions({
  canWrite,
  recordName,
  onEdit,
  onDelete,
  disabled = false,
  variant = 'inline',
}: RowActionsProps) {
  const { t } = useTranslation();

  if (!canWrite) {
    return null;
  }

  if (variant === 'menu') {
    const items: MenuProps['items'] = [
      { key: 'edit', icon: <EditOutlined />, label: t('common.edit') },
      { key: 'delete', icon: <DeleteOutlined />, label: t('common.delete'), danger: true },
    ];

    return (
      <Dropdown
        trigger={['click']}
        disabled={disabled}
        menu={{
          items,
          onClick: ({ key }) => (key === 'edit' ? onEdit() : onDelete()),
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<MoreOutlined />}
          disabled={disabled}
          // Names the row, so a screen reader user knows WHICH record this
          // opens the actions for (§11).
          aria-label={t('crud.rowActionsAria', { name: recordName })}
        />
      </Dropdown>
    );
  }

  return (
    <Space size="small">
      <Tooltip title={t('common.edit')}>
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          onClick={onEdit}
          disabled={disabled}
          aria-label={t('crud.editRecordAria', { name: recordName })}
        />
      </Tooltip>
      <Tooltip title={t('common.delete')}>
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={onDelete}
          disabled={disabled}
          aria-label={t('crud.deleteRecordAria', { name: recordName })}
        />
      </Tooltip>
    </Space>
  );
}
