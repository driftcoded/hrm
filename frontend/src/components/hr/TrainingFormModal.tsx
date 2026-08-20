import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useTrainingMutations } from '@/hooks/useHrProcess';
import {
  TRAINING_STATUSES,
  TRAINING_TYPES,
  type Training,
  type TrainingStatus,
  type TrainingType,
} from '@/types/hr-process.types';
import styles from './TrainingFormModal.module.css';

/** Form tạo/sửa một khoá đào tạo. */
export interface TrainingFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa khoá đó; `null` = tạo mới. */
  training?: Training | null;
}

interface FormValues {
  code: string;
  name: string;
  type: TrainingType;
  status: TrainingStatus;
  range?: [Dayjs | null, Dayjs | null];
  location?: string;
  trainer?: string;
  cost?: number;
  maxParticipants?: number;
  description?: string;
  attachmentUrl?: string;
  note?: string;
}

export function TrainingFormModal({
  open,
  onClose,
  training = null,
}: TrainingFormModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const mutations = useTrainingMutations();
  const [error, setError] = useState<string | null>(null);

  const isEdit = training !== null;

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    form.resetFields();

    if (training) {
      form.setFieldsValue({
        code: training.code,
        name: training.name,
        type: training.type,
        status: training.status,
        range: [
          training.startDate ? dayjs(training.startDate) : null,
          training.endDate ? dayjs(training.endDate) : null,
        ],
        location: training.location ?? undefined,
        trainer: training.trainer ?? undefined,
        cost: training.cost,
        maxParticipants: training.maxParticipants ?? undefined,
        description: training.description ?? undefined,
        attachmentUrl: training.attachmentUrl ?? undefined,
        note: training.note ?? undefined,
      });
    } else {
      form.setFieldsValue({ type: 'internal', status: 'planned', cost: 0 });
    }
  }, [open, training, form]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      setError(null);

      const [start, end] = values.range ?? [null, null];
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        type: values.type,
        status: values.status,
        startDate: start ? start.format('YYYY-MM-DD') : undefined,
        endDate: end ? end.format('YYYY-MM-DD') : undefined,
        location: values.location?.trim() || undefined,
        trainer: values.trainer?.trim() || undefined,
        cost: values.cost ?? 0,
        maxParticipants: values.maxParticipants ?? undefined,
        description: values.description?.trim() || undefined,
        attachmentUrl: values.attachmentUrl?.trim() || undefined,
        note: values.note?.trim() || undefined,
      };

      try {
        if (training) {
          await mutations.updateTraining({ id: training.id, payload });
        } else {
          await mutations.createTraining(payload);
        }

        onClose();
        message.success(
          t(isEdit ? 'hr.trainings.updateSuccess' : 'hr.trainings.createSuccess'),
        );
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={open}
      title={t(isEdit ? 'hr.trainings.edit' : 'hr.trainings.create')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={mutations.isCreating || mutations.isUpdating}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
      width={720}
    >
      {error && (
        <Alert type="error" showIcon title={error} className={styles.error} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="code"
              label={t('hr.trainings.fields.code')}
              rules={[{ required: true, message: t('hr.trainings.errors.code') }]}
            >
              {/* Mã khoá là thứ người dùng gõ để tra cứu — không tự sinh. */}
              <Input maxLength={30} disabled={isEdit} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item
              name="name"
              label={t('hr.trainings.fields.name')}
              rules={[{ required: true, message: t('hr.trainings.errors.name') }]}
            >
              <Input maxLength={200} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="type" label={t('hr.trainings.fields.type')}>
              <Select
                options={TRAINING_TYPES.map((value) => ({
                  value,
                  label: t(`hr.trainings.type.${value}`),
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label={t('hr.trainings.fields.status')}>
              <Select
                options={TRAINING_STATUSES.map((value) => ({
                  value,
                  label: t(`hr.trainings.status.${value}`),
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="range" label={t('hr.trainings.fields.range')}>
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                allowEmpty={[true, true]}
                className={styles.control}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="trainer" label={t('hr.trainings.fields.trainer')}>
              <Input maxLength={150} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="location" label={t('hr.trainings.fields.location')}>
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="cost" label={t('hr.trainings.fields.cost')}>
              <InputNumber<number>
                min={0}
                step={100000}
                className={styles.control}
                formatter={(value) =>
                  `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                }
                parser={(value) => Number((value ?? '').replace(/\./g, ''))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="maxParticipants"
          label={t('hr.trainings.fields.maxParticipants')}
          extra={t('hr.trainings.fields.maxParticipantsHint')}
        >
          <InputNumber min={1} max={1000} className={styles.control} />
        </Form.Item>

        <Form.Item name="description" label={t('hr.trainings.fields.description')}>
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>

        <Form.Item
          name="attachmentUrl"
          label={t('hr.trainings.fields.attachmentUrl')}
        >
          <Input maxLength={500} />
        </Form.Item>

        <Form.Item name="note" label={t('hr.trainings.fields.note')}>
          <Input.TextArea rows={2} maxLength={1000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
