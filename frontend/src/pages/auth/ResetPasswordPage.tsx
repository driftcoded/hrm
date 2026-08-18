import { useState } from 'react';
import { Alert, App, Button, Form, Input, type FormRule } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthShell } from '@/components/auth/AuthShell';
import { BrandMark } from '@/components/common/BrandMark';
import { useResetPassword } from '@/hooks/useAuth';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { PASSWORD_MIN_LENGTH, type ResetPasswordFormValues } from '@/types/auth.types';
import { getApiError } from '@/utils/apiError';
import styles from './authForm.module.css';

/** Codes that mean "this link is dead, get a new one". */
const TOKEN_ERROR_CODES = ['RESET_TOKEN_INVALID', 'RESET_TOKEN_EXPIRED'];

/**
 * `/reset-password?token=...` — set a new password from the emailed link.
 * A missing/invalid/expired token shows a clear message plus a way back to
 * /forgot-password.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const { mutateAsync, isPending } = useResetPassword();
  const resolveError = useApiErrorMessage();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [tokenRejected, setTokenRejected] = useState(false);

  const passwordRules: FormRule[] = [
    { required: true, message: t('auth.validation.passwordRequired') },
    {
      min: PASSWORD_MIN_LENGTH,
      message: t('auth.validation.passwordMin', { min: PASSWORD_MIN_LENGTH }),
    },
  ];

  const confirmRules: FormRule[] = [
    { required: true, message: t('auth.validation.confirmPasswordRequired') },
    ({ getFieldValue }) => ({
      validator: (_rule, value: string) =>
        !value || value === getFieldValue('newPassword')
          ? Promise.resolve()
          : Promise.reject(new Error(t('auth.validation.passwordMismatch'))),
    }),
  ];

  const handleFinish = async (values: ResetPasswordFormValues) => {
    setErrorText(null);
    try {
      await mutateAsync({
        token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      // Toast is correct here: we redirect to /login, so the source page (and
      // its inline surface) is gone.
      message.success(t('auth.resetSuccess'));
      navigate('/login', { replace: true });
    } catch (error) {
      // Inline Alert in the card only — no toast on top of it.
      const { code } = getApiError(error);
      setTokenRejected(TOKEN_ERROR_CODES.includes(code));
      setErrorText(resolveError(error));
    }
  };

  const linkIsDead = !token || tokenRejected;

  return (
    <AuthShell>
      <div className={styles.header}>
        <BrandMark size="lg" centered />
        <h2 className={styles.title}>{t('auth.resetTitle')}</h2>
        <p className={styles.subtitle}>
          {linkIsDead ? t('auth.resetLinkDeadSubtitle') : t('auth.resetSubtitle')}
        </p>
      </div>

      {(errorText || !token) && (
        <Alert
          className={styles.alert}
          type="error"
          showIcon
          role="alert"
          message={errorText ?? t('errors.api.RESET_TOKEN_INVALID')}
        />
      )}

      {linkIsDead ? (
        // Button + navigate() rather than <Link><Button> — an <a> must not wrap
        // a <button> (nested interactive content).
        <Button
          type="primary"
          block
          size="large"
          onClick={() => navigate('/forgot-password')}
        >
          {t('auth.requestNewLink')}
        </Button>
      ) : (
        <Form<ResetPasswordFormValues>
          name="resetPassword"
          layout="vertical"
          size="large"
          requiredMark={false}
          onFinish={handleFinish}
        >
          <Form.Item label={t('auth.newPassword')} name="newPassword" rules={passwordRules}>
            <Input.Password
              prefix={<LockOutlined className={styles.inputIcon} aria-hidden="true" />}
              placeholder={t('auth.newPasswordPlaceholder')}
              autoComplete="new-password"
              autoFocus
              disabled={isPending}
            />
          </Form.Item>

          <Form.Item
            label={t('auth.confirmPassword')}
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={confirmRules}
          >
            <Input.Password
              prefix={<LockOutlined className={styles.inputIcon} aria-hidden="true" />}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              autoComplete="new-password"
              disabled={isPending}
            />
          </Form.Item>

          <Form.Item className={styles.submitItem}>
            <Button type="primary" htmlType="submit" block size="large" loading={isPending}>
              {t('auth.resetSubmit')}
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
