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
  TRAINING_RESULTS,
  type TrainingParticipant,
  type TrainingResult,
} from '@/types/hr-process.types';
import styles from './TrainingFormModal.module.css';

/** Chấm kết quả cho một học viên sau khi khoá học kết thúc. */
export interface CompleteParticipantModalProps {
  trainingId: number | null;
  participant: TrainingParticipant | null;
  onClose: () => void;
}

interface FormValues {
  result: TrainingResult;
  completionDate?: Dayjs;
  score?: number;
  certificateUrl?: string;
  note?: string;
}

export function CompleteParticipantModal({
  trainingId,
  participant,
  onClose,
}: CompleteParticipantModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const mutations = useTrainingMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!participant) {
      return;
    }

    setError(null);
    form.resetFields();
    form.setFieldsValue({
      result: participant.result ?? 'passed',
      completionDate: participant.completionDate
        ? dayjs(participant.completionDate)
        : dayjs(),
      score: participant.score ?? undefined,
      certificateUrl: participant.certificateUrl ?? undefined,
      note: participant.note ?? undefined,
    });
  }, [participant, form]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      if (trainingId === null || !participant) {
        return;
      }

      setError(null);

      try {
        await mutations.completeParticipant({
          trainingId,
          employeeId: participant.employeeId,
          payload: {
            result: values.result,
            completionDate: values.completionDate?.format('YYYY-MM-DD'),
            score: values.score,
            certificateUrl: values.certificateUrl?.trim() || undefined,
            note: values.note?.trim() || undefined,
          },
        });

        onClose();
        message.success(t('hr.trainings.gradeSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={participant !== null}
      title={t('hr.trainings.gradeTitle', { name: participant?.fullName ?? '' })}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={mutations.isCompleting}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon title={error} className={styles.error} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="result"
              label={t('hr.trainings.fields.result')}
              rules={[
                { required: true, message: t('hr.trainings.errors.result') },
              ]}
            >
              <Select
                options={TRAINING_RESULTS.map((value) => ({
                  value,
                  label: t(`hr.trainings.result.${value}`),
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="completionDate"
              label={t('hr.trainings.fields.completionDate')}
            >
              <DatePicker format="DD/MM/YYYY" className={styles.control} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="score" label={t('hr.trainings.fields.score')}>
          <InputNumber min={0} max={100} className={styles.control} />
        </Form.Item>

        <Form.Item
          name="certificateUrl"
          label={t('hr.trainings.fields.certificateUrl')}
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
