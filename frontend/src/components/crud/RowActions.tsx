import { Button, Space, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * Edit + delete buttons for a table row.
 *
 * Renders `null` for a user without write permission, so a read-only role
 * (`manager` / `employee`) that opens a Settings page by URL sees the data but no
 * controls that would 403. The backend is still the real guard — this only keeps
 * the screen honest.
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
}

export function RowActions({
  canWrite,
  recordName,
  onEdit,
  onDelete,
  disabled = false,
}: RowActionsProps) {
  const { t } = useTranslation();

  if (!canWrite) {
    return null;
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
