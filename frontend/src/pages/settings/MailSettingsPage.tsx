import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Form, Input, InputNumber, Skeleton, Switch } from 'antd';
import { MailOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useMailSettings, useSendTestMail, useUpdateMailSettings } from '@/hooks/useMailSettings';
import { useCanManageSettings } from '@/hooks/usePermissions';
import type { UpdateMailSettingsPayload } from '@/types/settings.types';
import styles from './MailSettingsPage.module.css';

interface MailSettingsFormValues {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFromEmail: string;
  smtpFromName?: string;
}

/**
 * `/settings/mail` — SMTP configuration, admin only.
 *
 * Unlike branding, `GET /settings/mail` itself is admin-gated (it exposes
 * `hasPassword` and would be pointless read-only for anyone else, since the
 * whole point of this screen is credentials), so non-admins get a plain
 * permission notice instead of a read-only form.
 */
export function MailSettingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const canManage = useCanManageSettings();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<MailSettingsFormValues>();
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);

  const { data: settings, isLoading, isError, refetch } = useMailSettings();
  const updateSettings = useUpdateMailSettings();
  const sendTest = useSendTestMail();

  useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        smtpHost: settings.smtpHost ?? '',
        smtpPort: settings.smtpPort ?? 587,
        smtpSecure: settings.smtpSecure,
        smtpUsername: settings.smtpUsername ?? '',
        smtpFromEmail: settings.smtpFromEmail ?? '',
        smtpFromName: settings.smtpFromName ?? '',
      });
    }
  }, [settings, form]);

  const handleSubmit = async (values: MailSettingsFormValues) => {
    const payload: UpdateMailSettingsPayload = {
      smtpHost: values.smtpHost,
      smtpPort: values.smtpPort,
      smtpSecure: values.smtpSecure,
      smtpUsername: values.smtpUsername || null,
      smtpFromEmail: values.smtpFromEmail,
      smtpFromName: values.smtpFromName || null,
    };
    // Bỏ trống password trên form = giữ nguyên mật khẩu đã lưu — không gửi field
    // này lên thay vì gửi chuỗi rỗng, khớp đúng ngữ nghĩa của backend.
    if (values.smtpPassword) {
      payload.smtpPassword = values.smtpPassword;
    }

    try {
      await updateSettings.mutateAsync(payload);
      form.setFieldValue('smtpPassword', undefined);
      message.success(t('settings.mail.saveSuccess'));
    } catch (error) {
      message.error(resolveError(error));
    }
  };

  const handleSendTest = async () => {
    setTestResult(null);
    try {
      const result = await sendTest.mutateAsync(testEmail);
      setTestResult({
        type: 'success',
        text: t('settings.mail.testSuccess', { reference: result.reference }),
      });
    } catch (error) {
      setTestResult({ type: 'error', text: resolveError(error) });
    }
  };

  if (!canManage) {
    return (
      <>
        <PageHeader title={t('settings.mail.pageTitle')} />
        <Alert type="warning" showIcon message={t('settings.mail.accessDenied')} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('settings.mail.pageTitle')} subtitle={t('settings.mail.subtitle')} />

      {isLoading && (
        <Card className={styles.card}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      )}

      {!isLoading && isError && (
        <Alert
          type="error"
          showIcon
          message={t('settings.mail.loadError')}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && settings && (
        <div className={styles.grid}>
          <Card title={t('settings.mail.smtpTitle')} className={styles.card}>
            <Form<MailSettingsFormValues>
              form={form}
              layout="vertical"
              onFinish={(values) => void handleSubmit(values)}
            >
              <div className={styles.row}>
                <Form.Item
                  label={t('settings.mail.host')}
                  name="smtpHost"
                  className={styles.hostField}
                  rules={[{ required: true, message: t('settings.mail.validation.hostRequired') }]}
                >
                  <Input placeholder={t('settings.mail.hostPlaceholder')} />
                </Form.Item>

                <Form.Item
                  label={t('settings.mail.port')}
                  name="smtpPort"
                  className={styles.portField}
                  rules={[{ required: true, message: t('settings.mail.validation.portRequired') }]}
                >
                  <InputNumber min={1} max={65535} className={styles.fullWidth} />
                </Form.Item>

                <Form.Item
                  label={t('settings.mail.secure')}
                  name="smtpSecure"
                  valuePropName="checked"
                  className={styles.secureField}
                >
                  <Switch />
                </Form.Item>
              </div>

              <div className={styles.row}>
                <Form.Item
                  label={t('settings.mail.username')}
                  name="smtpUsername"
                  className={styles.halfField}
                >
                  <Input autoComplete="off" placeholder={t('settings.mail.usernamePlaceholder')} />
                </Form.Item>

                <Form.Item
                  label={t('settings.mail.password')}
                  name="smtpPassword"
                  className={styles.halfField}
                  extra={settings.hasPassword ? t('settings.mail.passwordHint') : undefined}
                >
                  <Input.Password
                    autoComplete="new-password"
                    placeholder={
                      settings.hasPassword
                        ? t('settings.mail.passwordPlaceholderSet')
                        : t('settings.mail.passwordPlaceholderUnset')
                    }
                  />
                </Form.Item>
              </div>

              <div className={styles.row}>
                <Form.Item
                  label={t('settings.mail.fromEmail')}
                  name="smtpFromEmail"
                  className={styles.halfField}
                  rules={[
                    { required: true, message: t('settings.mail.validation.fromEmailRequired') },
                    { type: 'email', message: t('settings.mail.validation.fromEmailInvalid') },
                  ]}
                >
                  <Input placeholder={t('settings.mail.fromEmailPlaceholder')} />
                </Form.Item>

                <Form.Item
                  label={t('settings.mail.fromName')}
                  name="smtpFromName"
                  className={styles.halfField}
                >
                  <Input placeholder={t('settings.mail.fromNamePlaceholder')} />
                </Form.Item>
              </div>

              <Form.Item className={styles.actions}>
                <Button type="primary" htmlType="submit" loading={updateSettings.isPending}>
                  {t('common.save')}
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title={t('settings.mail.testTitle')} className={styles.card}>
            <p className={styles.hint}>{t('settings.mail.testHint')}</p>

            <div className={styles.testRow}>
              <Input
                prefix={<MailOutlined className={styles.inputIcon} aria-hidden="true" />}
                placeholder={t('settings.mail.testEmailPlaceholder')}
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                disabled={sendTest.isPending}
              />
              <Button
                icon={<SendOutlined />}
                onClick={() => void handleSendTest()}
                loading={sendTest.isPending}
                disabled={!testEmail}
              >
                {t('settings.mail.testSend')}
              </Button>
            </div>

            {testResult && (
              <Alert
                className={styles.testResult}
                type={testResult.type}
                showIcon
                message={testResult.text}
              />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
