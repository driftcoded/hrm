import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  DatePicker,
  Form,
  Modal,
  Radio,
  Select,
  Switch,
  Table,
  Tag,
  type TableProps,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useGenerateHolidays } from '@/hooks/useHolidays';
import {
  NATIONAL_DAY_EXTRAS,
  TET_TOTAL_DAYS,
  type GenerateHolidaysResult,
  type HolidayDate,
  type NationalDayExtra,
} from '@/types/masterData.types';
import { formatDate } from '@/utils/format';
import styles from './GenerateHolidaysModal.module.css';

/**
 * Sinh lịch nghỉ lễ pháp định của một năm theo Điều 112 BLLĐ 2019.
 *
 * Luôn xem trước rồi mới ghi: hai tham số dưới đây là thứ Chính phủ chốt lại
 * từng năm chứ luật không ấn định, nên người dùng phải đối chiếu với thông báo
 * chính thức trước khi bấm tạo.
 */
export interface GenerateHolidaysModalProps {
  open: boolean;
  /** Năm đang lọc trên màn hình, dùng làm giá trị mặc định. */
  defaultYear?: number;
  onClose: () => void;
}

interface FormValues {
  year: Dayjs;
  tetDaysBefore: number;
  nationalDayExtra: NationalDayExtra;
  compensateWeekends: boolean;
}

export function GenerateHolidaysModal({
  open,
  defaultYear,
  onClose,
}: GenerateHolidaysModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { generate, isGenerating } = useGenerateHolidays();

  const [preview, setPreview] = useState<GenerateHolidaysResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPreview(null);
    setError(null);
    form.resetFields();
    form.setFieldsValue({
      year: dayjs().year(defaultYear ?? dayjs().year() + 1),
      tetDaysBefore: 1,
      nationalDayExtra: 'before',
      compensateWeekends: true,
    });
  }, [open, defaultYear, form]);

  const run = async (isPreview: boolean) => {
    const values = await form.validateFields();
    setError(null);

    try {
      const result = await generate({
        year: values.year.year(),
        tetDaysBefore: values.tetDaysBefore,
        nationalDayExtra: values.nationalDayExtra,
        compensateWeekends: values.compensateWeekends,
        preview: isPreview,
      });

      if (isPreview) {
        setPreview(result);
        return;
      }

      onClose();
      message.success(
        t('settings.holidays.generate.success', {
          created: result.created,
          skipped: result.skipped,
        }),
      );
    } catch (submitError) {
      setError(resolveError(submitError));
    }
  };

  const columns: TableProps<HolidayDate>['columns'] = [
    {
      title: t('settings.holidays.date'),
      dataIndex: 'holidayDate',
      width: 130,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('settings.holidays.name'),
      dataIndex: 'name',
      render: (value: string, row) => (
        <div className={styles.nameCell}>
          <span>{value}</span>
          {row.note && <span className={styles.note}>{row.note}</span>}
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={t('settings.holidays.generate.title')}
      okText={t('settings.holidays.generate.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: preview === null }}
      confirmLoading={isGenerating}
      onOk={() => void run(false)}
      onCancel={onClose}
      destroyOnHidden
      width={720}
    >
      <Alert
        type="info"
        showIcon
        className={styles.notice}
        title={t('settings.holidays.generate.notice')}
      />

      {error && (
        <Alert type="error" showIcon title={error} className={styles.notice} />
      )}

      <Form form={form} layout="vertical" onValuesChange={() => setPreview(null)}>
        <Form.Item
          name="year"
          label={t('settings.holidays.generate.year')}
          rules={[{ required: true, message: t('settings.validation.dateRequired') }]}
        >
          <DatePicker picker="year" className={styles.control} />
        </Form.Item>

        <Form.Item
          name="tetDaysBefore"
          label={t('settings.holidays.generate.tetDaysBefore')}
          extra={t('settings.holidays.generate.tetHint', { total: TET_TOTAL_DAYS })}
        >
          <Select
            options={Array.from({ length: TET_TOTAL_DAYS }, (_, index) => ({
              value: index,
              label: t('settings.holidays.generate.tetOption', {
                before: index,
                after: TET_TOTAL_DAYS - index,
              }),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="nationalDayExtra"
          label={t('settings.holidays.generate.nationalDay')}
          extra={t('settings.holidays.generate.nationalDayHint')}
        >
          <Radio.Group
            options={NATIONAL_DAY_EXTRAS.map((value) => ({
              value,
              label: t(`settings.holidays.generate.nationalDayExtra.${value}`),
            }))}
            optionType="button"
          />
        </Form.Item>

        <Form.Item
          name="compensateWeekends"
          label={t('settings.holidays.generate.compensate')}
          valuePropName="checked"
          extra={t('settings.holidays.generate.compensateHint')}
        >
          <Switch />
        </Form.Item>
      </Form>

      {preview === null ? (
        <button
          type="button"
          className={styles.previewButton}
          onClick={() => void run(true)}
          disabled={isGenerating}
        >
          {t('settings.holidays.generate.preview')}
        </button>
      ) : (
        <div className={styles.previewBox}>
          <div className={styles.previewHead}>
            <strong>
              {t('settings.holidays.generate.previewTitle', {
                year: preview.year,
              })}
            </strong>
            <span>
              <Tag color="green" bordered={false}>
                {t('settings.holidays.generate.willCreate', {
                  count: preview.created,
                })}
              </Tag>
              {preview.skipped > 0 && (
                <Tag bordered={false}>
                  {t('settings.holidays.generate.willSkip', {
                    count: preview.skipped,
                  })}
                </Tag>
              )}
            </span>
          </div>

          <Table<HolidayDate>
            rowKey={(row) => row.holidayDate}
            size="small"
            columns={columns}
            dataSource={preview.holidays}
            pagination={false}
            scroll={{ y: 260 }}
          />
        </div>
      )}
    </Modal>
  );
}
