import { useEffect, useState } from 'react';
import { Alert, App, Button, DatePicker, Modal, Space, Statistic } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useSalaryMutations } from '@/hooks/usePayroll';
import type { PayrollRunResult } from '@/types/payroll.types';
import { formatCurrency } from '@/utils/format';
import styles from './CalculatePayrollModal.module.css';

/**
 * Tính lương cho một kỳ.
 *
 * HAI BƯỚC, KHÔNG PHẢI MỘT. Bấm "Tính thử" chạy `dryRun`: người dùng thấy sẽ
 * tạo bao nhiêu phiếu, ghi đè bao nhiêu, bỏ qua bao nhiêu dòng đã chốt — rồi mới
 * có nút tính thật. Đây là thao tác chạm vào tiền lương của cả công ty trong một
 * lần bấm, và nó không có nút hoàn tác.
 *
 * HAI LÝ DO BỎ QUA ĐƯỢC NÊU RIÊNG. `skippedLocked` là phiếu đã duyệt/đã trả nên
 * CỐ Ý không đụng vào — bình thường. `skippedNoContract` là thiếu dữ liệu và
 * phải đi sửa hợp đồng. Gộp hai con số làm một sẽ giấu mất cái thứ hai.
 */
export interface CalculatePayrollModalProps {
  open: boolean;
  onClose: () => void;
  /** Kỳ đang xem trên bảng — dùng làm mặc định. */
  defaultYear: number;
  defaultMonth: number;
}

export function CalculatePayrollModal({
  open,
  onClose,
  defaultYear,
  defaultMonth,
}: CalculatePayrollModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const mutations = useSalaryMutations();

  const [period, setPeriod] = useState<Dayjs>(
    dayjs().year(defaultYear).month(defaultMonth - 1),
  );
  const [preview, setPreview] = useState<PayrollRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPeriod(dayjs().year(defaultYear).month(defaultMonth - 1));
      setPreview(null);
      setError(null);
    }
  }, [open, defaultYear, defaultMonth]);

  const run = (dryRun: boolean) => {
    void (async () => {
      setError(null);

      try {
        const result = await mutations.calculatePayroll({
          year: period.year(),
          month: period.month() + 1,
          dryRun,
        });

        if (dryRun) {
          setPreview(result);
          return;
        }

        onClose();
        message.success(
          t('payroll.calculate.success', {
            created: result.created,
            updated: result.updated,
          }),
        );
      } catch (runError) {
        setError(resolveError(runError));
      }
    })();
  };

  return (
    <Modal
      open={open}
      title={t('payroll.calculate.title')}
      width={640}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={mutations.isCalculating} onClick={() => run(true)}>
            {t('payroll.calculate.preview')}
          </Button>
          <Button
            type="primary"
            // Chỉ mở khoá sau khi đã tính thử: người bấm phải nhìn thấy con số
            // trước khi ghi cho cả công ty.
            disabled={preview === null}
            loading={mutations.isCalculating}
            onClick={() => run(false)}
          >
            {t('payroll.calculate.commit')}
          </Button>
        </Space>
      }
    >
      <div className={styles.body}>
        <p className={styles.hint}>{t('payroll.calculate.hint')}</p>

        <DatePicker
          picker="month"
          allowClear={false}
          format="MM/YYYY"
          value={period}
          onChange={(next) => {
            if (next) {
              setPeriod(next);
              // Đổi kỳ làm bản tính thử cũ hết giá trị.
              setPreview(null);
            }
          }}
        />

        {error && <Alert type="error" showIcon title={error} />}

        {preview && (
          <>
            <div className={styles.stats}>
              <Statistic
                title={t('payroll.calculate.standardDays')}
                value={preview.standardWorkingDays}
              />
              <Statistic
                title={t('payroll.calculate.willCreate')}
                value={preview.created}
              />
              <Statistic
                title={t('payroll.calculate.willUpdate')}
                value={preview.updated}
              />
            </div>

            <div className={styles.totals}>
              <span>{t('payroll.calculate.totalGross')}</span>
              <strong>{formatCurrency(preview.totalGross)}</strong>
            </div>
            <div className={styles.totals}>
              <span>{t('payroll.calculate.totalNet')}</span>
              <strong>{formatCurrency(preview.totalNet)}</strong>
            </div>

            {preview.skippedLocked > 0 && (
              <Alert
                type="info"
                showIcon
                title={t('payroll.calculate.lockedTitle', {
                  count: preview.skippedLocked,
                })}
                description={t('payroll.calculate.lockedDetail')}
              />
            )}

            {/*
              Thiếu hợp đồng là dữ liệu sai chứ không phải trạng thái bình
              thường — cảnh báo, và nêu thẳng mã nhân viên để đi sửa được ngay.
            */}
            {preview.skippedNoContract.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={t('payroll.calculate.noContractTitle', {
                  count: preview.skippedNoContract.length,
                })}
                description={t('payroll.calculate.noContractDetail', {
                  codes: preview.skippedNoContract.slice(0, 12).join(', '),
                })}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
