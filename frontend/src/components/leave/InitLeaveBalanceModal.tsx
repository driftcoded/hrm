import { useEffect, useState } from 'react';
import { Alert, App, Button, Checkbox, DatePicker, Modal, Space, Statistic } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveBalanceMutations } from '@/hooks/useLeave';
import type { InitLeaveBalanceResult } from '@/types/leave.types';
import styles from './InitLeaveBalanceModal.module.css';

/**
 * Cấp quỹ phép năm cho toàn bộ nhân viên đang làm việc.
 *
 * HAI BƯỚC, KHÔNG PHẢI MỘT. Bấm "Tính thử" chạy `dryRun`: người dùng thấy sẽ
 * cấp cho bao nhiêu người, bỏ qua bao nhiêu — rồi mới có nút cấp thật. Đây là
 * thao tác chạm vào cả công ty trong một lần bấm, và nó không có nút hoàn tác.
 *
 * `skipped` được nêu riêng: backend KHÔNG ghi đè quỹ đã có, nên chạy lại lần
 * hai là an toàn. Không nói ra thì người dùng sẽ ngại bấm, hoặc tệ hơn là đi
 * xoá quỹ cũ trước khi chạy lại.
 */
export interface InitLeaveBalanceModalProps {
  open: boolean;
  onClose: () => void;
  /** Năm đang xem trên bảng — dùng làm mặc định. */
  defaultYear: number;
}

export function InitLeaveBalanceModal({
  open,
  onClose,
  defaultYear,
}: InitLeaveBalanceModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const mutations = useLeaveBalanceMutations();

  const [year, setYear] = useState<Dayjs>(dayjs().year(defaultYear));
  const [carryOver, setCarryOver] = useState(false);
  const [preview, setPreview] = useState<InitLeaveBalanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setYear(dayjs().year(defaultYear));
      setCarryOver(false);
      setPreview(null);
      setError(null);
    }
  }, [open, defaultYear]);

  /** Đổi năm hoặc đổi tuỳ chọn chuyển phép làm bản tính thử cũ hết giá trị. */
  const invalidatePreview = () => setPreview(null);

  const runPreview = () => {
    void (async () => {
      setError(null);
      try {
        setPreview(
          await mutations.previewInit({ year: year.year(), carryOver }),
        );
      } catch (previewError) {
        setError(resolveError(previewError));
      }
    })();
  };

  const runCommit = () => {
    void (async () => {
      setError(null);
      try {
        const result = await mutations.commitInit({
          year: year.year(),
          carryOver,
        });
        onClose();
        message.success(
          t('leave.balances.initSuccess', {
            created: result.created,
            skipped: result.skipped,
          }),
        );
      } catch (commitError) {
        setError(resolveError(commitError));
      }
    })();
  };

  return (
    <Modal
      open={open}
      title={t('leave.balances.initTitle')}
      width={560}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={mutations.isPreviewing} onClick={runPreview}>
            {t('leave.balances.preview')}
          </Button>
          <Button
            type="primary"
            // Chỉ mở khoá sau khi đã tính thử: người bấm phải nhìn thấy con số
            // trước khi ghi cho cả công ty.
            disabled={preview === null}
            loading={mutations.isCommitting}
            onClick={runCommit}
          >
            {preview
              ? t('leave.balances.commitWithCount', { count: preview.created })
              : t('leave.balances.commit')}
          </Button>
        </Space>
      }
    >
      <div className={styles.body}>
        <p className={styles.hint}>{t('leave.balances.initHint')}</p>

        <div className={styles.controls}>
          <DatePicker
            picker="year"
            allowClear={false}
            value={year}
            format="YYYY"
            onChange={(next) => {
              if (next) {
                setYear(next);
                invalidatePreview();
              }
            }}
          />

          <Checkbox
            checked={carryOver}
            onChange={(event) => {
              setCarryOver(event.target.checked);
              invalidatePreview();
            }}
          >
            {t('leave.balances.carryOver')}
          </Checkbox>
        </div>

        {/*
          Chuyển phép sang năm sau là quy định NỘI BỘ, không phải luật — nên nó
          là một lựa chọn tường minh, mặc định tắt.
        */}
        <p className={styles.hint}>{t('leave.balances.carryOverHint')}</p>

        {error && <Alert type="error" showIcon message={error} />}

        {preview && (
          <>
            <div className={styles.stats}>
              <Statistic
                title={t('leave.balances.employeesConsidered')}
                value={preview.employeesConsidered}
              />
              <Statistic
                title={t('leave.balances.willCreate')}
                value={preview.created}
              />
              <Statistic
                title={t('leave.balances.willSkip')}
                value={preview.skipped}
              />
            </div>

            {preview.skipped > 0 && (
              <Alert
                type="info"
                showIcon
                message={t('leave.balances.skipTitle', { count: preview.skipped })}
                description={t('leave.balances.skipDetail')}
              />
            )}

            {preview.created === 0 && preview.skipped > 0 && (
              <Alert type="success" showIcon message={t('leave.balances.allDone')} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
