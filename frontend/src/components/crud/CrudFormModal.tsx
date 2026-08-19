import type { ReactNode } from 'react';
import { Alert, Form, Modal, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './CrudFormModal.module.css';

/**
 * Create/edit modal shared by the Settings screens
 * (docs/ui-conventions.md §4 and §9): `vertical` layout, "Lưu" (primary) on the
 * right of "Hủy", both disabled while submitting, `maskClosable={false}` so a
 * stray click outside cannot discard typed data.
 *
 * The submit error is rendered as an inline `Alert` at the top of the form and
 * nowhere else (§8 "KHÔNG thông báo trùng") — the modal is still open, so this is
 * the one place the user is already looking.
 *
 * The page supplies the fields as children and keeps ownership of the `Form`
 * instance, so each screen declares its own fields and validation rules while the
 * frame, the footer and the error surface stay identical everywhere.
 */

export interface CrudFormModalProps<TValues> {
  open: boolean;
  /** Modal title — "Thêm phòng ban" / "Sửa phòng ban". */
  title: string;
  form: FormInstance<TValues>;
  /**
   * Identity of the record being edited (`row.id`, or `'create'` for a new one).
   *
   * It becomes the `<Form>`'s React key: closing the modal swaps it for
   * `'closed'`, so the next opening remounts the fields and `initialValues` is
   * read again. Without that, AntD would keep the previous record's values —
   * `initialValues` is only consulted when a Form mounts.
   */
  recordKey: string | number;
  initialValues: Partial<TValues>;
  onSubmit: (values: TValues) => void;
  onCancel: () => void;
  isSaving: boolean;
  /** Inline error text from the last failed submit, or `null`. */
  submitError: string | null;
  /** 520 (small) / 720 (medium) / 960 (large) per §9. */
  width?: 520 | 720 | 960;
  children: ReactNode;
}

export function CrudFormModal<TValues extends object>({
  open,
  title,
  form,
  recordKey,
  initialValues,
  onSubmit,
  onCancel,
  isSaving,
  submitError,
  width = 520,
  children,
}: CrudFormModalProps<TValues>) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={title}
      width={width}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      okButtonProps={{ loading: isSaving }}
      cancelButtonProps={{ disabled: isSaving }}
      // §9: a form with data must not be dismissed by a click on the backdrop.
      maskClosable={false}
    >
      {submitError && (
        <Alert className={styles.alert} type="error" showIcon title={submitError} role="alert" />
      )}
      <Form<TValues>
        key={open ? recordKey : 'closed'}
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onSubmit}
        disabled={isSaving}
        requiredMark
        className={styles.form}
      >
        {children}
      </Form>
    </Modal>
  );
}
