import { useEffect } from 'react';
import { Alert, App, Button, Card, Form, InputNumber, Select, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  usePayrollSettings,
  usePayrollSettingsMutation,
} from '@/hooks/usePayroll';
import { formatCurrency } from '@/utils/format';
import type { UpdatePayrollSettingsPayload } from '@/types/payroll.types';
import styles from './PayrollSettingsPage.module.css';

/**
 * `/payroll/settings` — cấu hình lương cấp CÔNG TY (PLAN 6.2).
 *
 * Ở đây là những thứ GIỐNG NHAU cho mọi người. Lương cơ bản, lương đóng bảo hiểm
 * và phụ cấp chức vụ là thoả thuận riêng với từng người và nằm ở HỢP ĐỒNG — sửa
 * ở màn hình nhân viên, không sửa ở đây.
 *
 * VÙNG LƯƠNG TỐI THIỂU KHÔNG PHẢI MỘT Ô CHO ĐẸP: nó quyết định TRẦN đóng BHTN
 * (20 × lương tối thiểu vùng), khác trần BHXH/BHYT (20 × mức tham chiếu). Chọn
 * sai vùng là tính sai BHTN của mọi người lương cao, nên mỗi lựa chọn hiện kèm
 * luôn con số trần mà nó kéo theo.
 */

/** Lương tối thiểu vùng 2026 (NĐ 293/2025/NĐ-CP) — chỉ để HIỂN THỊ hệ quả. */
const REGION_MINIMUM_WAGE: Record<number, number> = {
  1: 5_310_000,
  2: 4_730_000,
  3: 4_140_000,
  4: 3_700_000,
};

interface FormValues {
  minimumWageRegion: number;
  mealAllowance: number;
  transportAllowance: number;
  phoneAllowance: number;
  attendanceAllowance: number;
  payOvertime: boolean;
}

export function PayrollSettingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();

  const query = usePayrollSettings();
  const { updateSettings, isSaving } = usePayrollSettingsMutation();

  useEffect(() => {
    if (query.data) {
      form.setFieldsValue(query.data);
    }
  }, [query.data, form]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      try {
        await updateSettings(values as UpdatePayrollSettingsPayload);
        message.success(t('payroll.settings.success'));
      } catch (error) {
        message.error(resolveError(error));
      }
    })();
  };

  if (query.isLoading) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={resolveError(query.error) || t('payroll.settings.loadError')}
        action={
          <Button size="small" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <Card variant="borderless" title={t('payroll.settings.title')}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={isSaving}
        className={styles.form}
      >
        <Form.Item
          name="minimumWageRegion"
          label={t('payroll.settings.fields.region')}
          extra={t('payroll.settings.regionHint')}
        >
          <Select
            className={styles.control}
            options={[1, 2, 3, 4].map((region) => ({
              value: region,
              label: t('payroll.settings.regionOption', {
                region,
                wage: formatCurrency(REGION_MINIMUM_WAGE[region]),
                cap: formatCurrency(REGION_MINIMUM_WAGE[region] * 20),
              }),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="mealAllowance"
          label={t('payroll.settings.fields.meal')}
          extra={t('payroll.settings.mealHint')}
        >
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.control}
            formatter={formatVnd}
            parser={parseVnd}
          />
        </Form.Item>

        <Form.Item
          name="transportAllowance"
          label={t('payroll.settings.fields.transport')}
        >
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.control}
            formatter={formatVnd}
            parser={parseVnd}
          />
        </Form.Item>

        <Form.Item name="phoneAllowance" label={t('payroll.settings.fields.phone')}>
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.control}
            formatter={formatVnd}
            parser={parseVnd}
          />
        </Form.Item>

        <Form.Item
          name="attendanceAllowance"
          label={t('payroll.settings.fields.attendance')}
          extra={t('payroll.settings.attendanceHint')}
        >
          <InputNumber<number>
            min={0}
            step={100000}
            className={styles.control}
            formatter={formatVnd}
            parser={parseVnd}
          />
        </Form.Item>

        <Form.Item
          name="payOvertime"
          label={t('payroll.settings.fields.payOvertime')}
          extra={t('payroll.settings.payOvertimeHint')}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <p className={styles.footnote}>{t('payroll.settings.scopeNote')}</p>

        <Button type="primary" htmlType="submit" loading={isSaving}>
          {t('common.save')}
        </Button>
      </Form>
    </Card>
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
