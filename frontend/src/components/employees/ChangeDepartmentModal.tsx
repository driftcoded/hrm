import { useEffect } from 'react';
import { Alert, Form, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './ChangeDepartmentModal.module.css';

/**
 * Chuyển các nhân viên đang chọn sang phòng ban khác.
 *
 * Component trình bày thuần — trang sở hữu vùng chọn và gọi hook (frontend/
 * CLAUDE.md: components/ không gọi API). Vì danh sách chức vụ phụ thuộc phòng
 * ban ĐANG chọn trong chính modal này, phòng ban được nâng lên state của trang
 * để trang truy vấn đúng bộ chức vụ.
 *
 * CHỨC VỤ BẮT BUỘC chứ không phải tuỳ chọn: `positions.department_id` là cột
 * bắt buộc, nên giữ chức vụ cũ sau khi đổi phòng sẽ để lại hồ sơ mang chức vụ
 * của phòng khác — đúng thứ backend chặn bằng `POSITION_DEPARTMENT_MISMATCH`.
 */

interface Option {
  value: number;
  label: string;
}

interface ChangeDepartmentFormValues {
  departmentId: number;
  positionId: number;
}

export interface ChangeDepartmentModalProps {
  open: boolean;
  /** Số nhân viên đang chọn. */
  employeeCount: number;
  departments: Option[];
  positions: Option[];
  isLoadingPositions: boolean;
  /** Phòng ban đích đang chọn — do trang giữ để truy vấn chức vụ theo nó. */
  departmentId?: number;
  onDepartmentChange: (departmentId: number) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (values: ChangeDepartmentFormValues) => void;
}

export function ChangeDepartmentModal({
  open,
  employeeCount,
  departments,
  positions,
  isLoadingPositions,
  departmentId,
  onDepartmentChange,
  isSaving,
  onCancel,
  onSubmit,
}: ChangeDepartmentModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ChangeDepartmentFormValues>();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  return (
    <Modal
      open={open}
      title={t('employees.moveDepartment.title')}
      okText={t('employees.moveDepartment.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={isSaving}
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then(onSubmit);
      }}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        className={styles.summary}
        title={t('employees.moveDepartment.summary', { count: employeeCount })}
      />

      <Form form={form} layout="vertical" disabled={isSaving}>
        <Form.Item
          name="departmentId"
          label={t('employees.moveDepartment.department')}
          rules={[
            { required: true, message: t('employees.moveDepartment.departmentRequired') },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('employees.moveDepartment.departmentPlaceholder')}
            options={departments}
            onChange={(value: number) => {
              // Chức vụ cũ thuộc phòng cũ nên không còn hợp lệ — xoá luôn thay
              // vì để lại một lựa chọn sẽ bị backend từ chối.
              form.setFieldValue('positionId', undefined);
              onDepartmentChange(value);
            }}
          />
        </Form.Item>

        <Form.Item
          name="positionId"
          label={t('employees.moveDepartment.position')}
          extra={t('employees.moveDepartment.positionHint')}
          rules={[
            { required: true, message: t('employees.moveDepartment.positionRequired') },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={isLoadingPositions}
            disabled={departmentId === undefined}
            placeholder={
              departmentId === undefined
                ? t('employees.moveDepartment.positionPickDepartment')
                : t('employees.moveDepartment.positionPlaceholder')
            }
            options={positions}
            notFoundContent={
              isLoadingPositions ? null : t('employees.moveDepartment.noPosition')
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
