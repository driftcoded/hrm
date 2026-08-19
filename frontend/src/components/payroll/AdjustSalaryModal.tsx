import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, InputNumber, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useSalaryMutations } from '@/hooks/usePayroll';
import type { Salary } from '@/types/payroll.types';
import { formatCurrency } from '@/utils/format';
import styles from './AdjustSalaryModal.module.css';

/**
 * Chỉnh tay một phiếu lương.
 *
 * CHỈ BA KHOẢN, và chúng có chung một tính chất: KHÔNG suy ra được từ dữ liệu
 * gốc. Thưởng hiệu suất do quản lý quyết theo kỳ; thu nhập khác và khấu trừ khác
 * là việc phát sinh. Mọi thứ còn lại — lương cơ bản, bảo hiểm, thuế, ngày công —
 * do server tính từ hợp đồng và chấm công, và cho sửa tay là mở đường cho một
 * bảng lương không khớp với bất kỳ dữ liệu gốc nào.
 *
 * SỬA XONG SERVER TÍNH LẠI THUẾ. Con số thực nhận hiện ở đây là số CŨ, nên nhãn
 * nói rõ nó sẽ đổi — hiện một con số sẽ sai ngay sau khi bấm lưu thì thà không
 * hiện.
 */
export interface AdjustSalaryModalProps {
  salary: Salary | null;
  onClose: () => void;
}

interface FormValues {
  performanceBonus: number;
  otherIncome: number;
  otherDeductions: number;
  note?: string;
}

export function AdjustSalaryModal({ salary, onClose }: AdjustSalaryModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { updateSalary, isUpdating } = useSalaryMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (salary) {
      setError(null);
      form.setFieldsValue({
        performanceBonus: salary.performanceBonus,
        otherIncome: salary.otherIncome,
        otherDeductions: salary.otherDeductions,
        note: salary.note ?? undefined,
      });
    }
  }, [salary, form]);

  const handleSubmit = (values: FormValues) => {
    if (!salary) {
      return;
    }

    void (async () => {
      setError(null);

      try {
        await updateSalary({
          id: salary.id,
          payload: {
            performanceBonus: values.performanceBonus,
            otherIncome: values.otherIncome,
            otherDeductions: values.otherDeductions,
            note: values.note ?? '',
          },
        });
        onClose();
        message.success(t('payroll.adjust.success'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={salary !== null}
      title={t('payroll.adjust.title')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={isUpdating}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      {salary && (
        <p className={styles.subject}>
          <strong>{salary.employee.fullName}</strong>
          <span className={styles.meta}>
            {salary.employee.employeeCode} · {t('payroll.periodLabel', {
              month: salary.month,
              year: salary.year,
            })}
          </span>
        </p>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={isUpdating}
      >
        <Form.Item
          name="performanceBonus"
          label={t('payroll.fields.performanceBonus')}
        >
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.number}
            formatter={(value) => formatVnd(value)}
            parser={(value) => parseVnd(value)}
          />
        </Form.Item>

        <Form.Item name="otherIncome" label={t('payroll.fields.otherIncome')}>
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.number}
            formatter={(value) => formatVnd(value)}
            parser={(value) => parseVnd(value)}
          />
        </Form.Item>

        <Form.Item
          name="otherDeductions"
          label={t('payroll.fields.otherDeductions')}
        >
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.number}
            formatter={(value) => formatVnd(value)}
            parser={(value) => parseVnd(value)}
          />
        </Form.Item>

        <Form.Item name="note" label={t('payroll.fields.note')}>
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
      </Form>

      {salary && (
        <p className={styles.hint}>
          {t('payroll.adjust.recalcHint', {
            net: formatCurrency(salary.netSalary),
          })}
        </p>
      )}
    </Modal>
  );
}

/** 1000000 → "1.000.000" — cùng cách chấm nghìn với `formatCurrency`. */
function formatVnd(value?: number | string): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseVnd(value?: string): number {
  return Number((value ?? '').replace(/\D/g, '')) || 0;
}
