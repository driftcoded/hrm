import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Modal,
  Space,
  Statistic,
  Table,
  Upload,
  type UploadFile,
} from 'antd';
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAttendanceImport } from '@/hooks/useAttendances';
import type {
  AttendanceImportError,
  AttendanceImportResult,
} from '@/types/attendance.types';
import styles from './ImportAttendanceModal.module.css';

/**
 * Nạp bảng chấm công từ file Excel.
 *
 * HAI BƯỚC, KHÔNG PHẢI MỘT. Chọn file chỉ chạy KIỂM TRA (`dryRun`); người dùng
 * thấy sẽ tạo mới bao nhiêu, ghi đè bao nhiêu, sai ở dòng nào — rồi mới có nút
 * ghi thật. Nạp thẳng một phát sẽ khiến một file sai cột ghi đè cả tháng công
 * trước khi ai kịp nhìn.
 *
 * SỐ NGÀY CÔNG BỊ GHI ĐÈ ĐƯỢC NÊU RIÊNG và có cảnh báo. Nạp lại file máy chấm
 * công sau khi sửa là chuyện bình thường, nhưng thay đổi một ngày công đã chốt
 * thì phải là một quyết định chứ không phải một tác dụng phụ.
 *
 * Danh sách lỗi hiện SỐ DÒNG TRONG FILE, không phải số thứ tự bản ghi — người
 * dùng sẽ mở Excel và nhảy tới đúng dòng đó.
 */
export interface ImportAttendanceModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportAttendanceModal({ open, onClose }: ImportAttendanceModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const importer = useAttendanceImport();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttendanceImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const runValidate = (selected: File) => {
    void (async () => {
      setError(null);
      setPreview(null);
      setFile(selected);

      try {
        setPreview(await importer.validate(selected));
      } catch (validateError) {
        setError(resolveError(validateError));
        setFile(null);
      }
    })();
  };

  const runCommit = () => {
    if (!file) {
      return;
    }

    void (async () => {
      setError(null);
      try {
        const result = await importer.commit(file);
        onClose();
        message.success(
          t('attendance.import.success', {
            created: result.created,
            updated: result.updated,
          }),
        );
      } catch (commitError) {
        setError(resolveError(commitError));
      }
    })();
  };

  const runTemplate = () => {
    void (async () => {
      try {
        await importer.downloadTemplate(undefined);
      } catch (templateError) {
        message.error(resolveError(templateError));
      }
    })();
  };

  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const canCommit = Boolean(file) && preview !== null && !hasErrors;

  return (
    <Modal
      open={open}
      title={t('attendance.import.title')}
      width={720}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            disabled={!canCommit}
            loading={importer.isCommitting}
            onClick={runCommit}
          >
            {preview && preview.updated > 0
              ? t('attendance.import.commitWithOverwrite', { count: preview.updated })
              : t('attendance.import.commit')}
          </Button>
        </Space>
      }
    >
      <div className={styles.body}>
        <div className={styles.templateRow}>
          <p className={styles.hint}>{t('attendance.import.columnsHint')}</p>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            loading={importer.isDownloadingTemplate}
            onClick={runTemplate}
          >
            {t('attendance.import.template')}
          </Button>
        </div>

        <Upload.Dragger
          accept=".xlsx"
          maxCount={1}
          fileList={file ? ([{ uid: '1', name: file.name }] as UploadFile[]) : []}
          /*
           * `beforeUpload` trả `false`: AntD không tự POST đi đâu cả. Việc gửi
           * do service của ta làm, qua axios đã gắn sẵn Authorization —
           * uploader tự gửi sẽ đi thiếu token và luôn nhận 401.
           */
          beforeUpload={(selected) => {
            runValidate(selected as unknown as File);
            return false;
          }}
          onRemove={() => {
            setFile(null);
            setPreview(null);
            setError(null);
          }}
          disabled={importer.isValidating || importer.isCommitting}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('attendance.import.dropHint')}</p>
          <p className="ant-upload-hint">{t('attendance.import.dropSubHint')}</p>
        </Upload.Dragger>

        {error && <Alert type="error" showIcon message={error} />}

        {preview && (
          <>
            <div className={styles.stats}>
              <Statistic
                title={t('attendance.import.totalRows')}
                value={preview.totalRows}
              />
              <Statistic
                title={t('attendance.import.created')}
                value={hasErrors ? 0 : preview.created}
              />
              <Statistic
                title={t('attendance.import.updated')}
                value={hasErrors ? 0 : preview.updated}
              />
            </div>

            {hasErrors ? (
              /*
               * Nói thẳng rằng KHÔNG dòng nào được ghi. Người dùng quen với
               * kiểu import "bỏ qua dòng lỗi" sẽ tưởng phần còn lại đã vào.
               */
              <Alert
                type="error"
                showIcon
                message={t('attendance.import.rejectedTitle', {
                  count: preview.errors.length,
                })}
                description={t('attendance.import.rejectedDetail')}
              />
            ) : preview.updated > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={t('attendance.import.overwriteTitle', {
                  count: preview.updated,
                })}
                description={t('attendance.import.overwriteDetail')}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message={t('attendance.import.readyTitle', { count: preview.created })}
              />
            )}

            {hasErrors && (
              <Table<AttendanceImportError>
                size="small"
                rowKey={(row) => `${row.row}-${row.code}`}
                dataSource={preview.errors}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ y: 240 }}
                columns={[
                  {
                    title: t('attendance.import.errorRow'),
                    dataIndex: 'row',
                    width: 80,
                  },
                  {
                    title: t('attendance.import.errorEmployee'),
                    dataIndex: 'employeeCode',
                    width: 110,
                    render: (value: string | null) => value ?? '—',
                  },
                  {
                    title: t('attendance.import.errorMessage'),
                    dataIndex: 'message',
                  },
                ]}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
