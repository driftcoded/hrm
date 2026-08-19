import { useState } from 'react';
import { Alert, Button, Form, Input, type FormRule } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AuthShell } from '@/components/auth/AuthShell';
import { BrandMark } from '@/components/common/BrandMark';
import { useForgotPassword } from '@/hooks/useAuth';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import type { ForgotPasswordFormValues } from '@/types/auth.types';
import { isEmail } from '@/utils/validators';
import styles from './authForm.module.css';

/**
 * `/forgot-password` — email field + submit.
 *
 * The backend always answers 200 (no user enumeration), so the confirmation is
 * deliberately neutral: "if that email exists, we've sent a link".
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useForgotPassword();
  const resolveError = useApiErrorMessage();
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const emailRules: FormRule[] = [
    { required: true, whitespace: true, message: t('auth.validation.emailRequired') },
    {
      validator: (_rule, value: string) =>
        !value || isEmail(value)
          ? Promise.resolve()
          : Promise.reject(new Error(t('auth.validation.emailInvalid'))),
    },
  ];

  const handleFinish = async (values: ForgotPasswordFormValues) => {
    setErrorText(null);
    try {
      await mutateAsync({ email: values.email.trim() });
      setSubmitted(true);
    } catch (error) {
      // The endpoint itself never reports "unknown email" — this only fires on
      // transport/server failures. Shown inline in the card, never as a toast.
      setErrorText(resolveError(error));
    }
  };

  return (
    <AuthShell>
      <div className={styles.header}>
        <BrandMark size="lg" centered />
        <h2 className={styles.title}>{t('auth.forgotTitle')}</h2>
        <p className={styles.subtitle}>{t('auth.forgotSubtitle')}</p>
      </div>

      {errorText && (
        <Alert className={styles.alert} type="error" showIcon title={errorText} role="alert" />
      )}

      {submitted ? (
        <Alert
          type="success"
          showIcon
          title={t('auth.forgotSentTitle')}
          description={t('auth.forgotSentDescription')}
          role="status"
        />
      ) : (
        <Form<ForgotPasswordFormValues>
          name="forgotPassword"
          layout="vertical"
          size="large"
          requiredMark={false}
          onFinish={handleFinish}
        >
          <Form.Item label={t('auth.email')} name="email" rules={emailRules}>
            <Input
              prefix={<MailOutlined className={styles.inputIcon} aria-hidden="true" />}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              autoFocus
              disabled={isPending}
              inputMode="email"
            />
          </Form.Item>
          <Form.Item className={styles.submitItem}>
            <Button type="primary" htmlType="submit" block size="large" loading={isPending}>
              {t('auth.forgotSubmit')}
            </Button>
          </Form.Item>
        </Form>
      )}

      <p className={styles.backRow}>
        <Link className={styles.backLink} to="/login">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}
