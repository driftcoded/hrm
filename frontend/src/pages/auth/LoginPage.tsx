import { useState } from 'react';
import { Alert, App, Button, Checkbox, Form, Input, type FormRule } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AuthShell } from '@/components/auth/AuthShell';
import { BrandMark } from '@/components/common/BrandMark';
import { PlaceholderLink } from '@/components/auth/PlaceholderLink';
import { SsoButtons } from '@/components/auth/SsoButtons';
import { useLogin } from '@/hooks/useAuth';
import { useLoginErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAuthStore } from '@/store/authStore';
import { PASSWORD_MIN_LENGTH, type LoginFormValues } from '@/types/auth.types';
import { isValidLoginIdentifier, sanitizeRedirectPath } from '@/utils/validators';
import styles from './authForm.module.css';

interface LoginLocationState {
  from?: string;
}

/**
 * `/login` — two-column split screen: brand panel (left) + login card (right).
 *
 * Layout/composition follows the design supplied for phase 1.2; all copy,
 * branding and the illustration are original to this project.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { mutateAsync, isPending } = useLogin();
  const resolveLoginError = useLoginErrorMessage();
  const [errorText, setErrorText] = useState<string | null>(null);

  // Return path when the user was bounced off a protected route. `?redirect=`
  // is used by PrivateRoute and by the axios refresh-failure redirect;
  // `location.state.from` is the router-native fallback. Both are sanitized
  // against open redirects.
  const stateFrom = (location.state as LoginLocationState | null)?.from;
  const redirectTo = sanitizeRedirectPath(searchParams.get('redirect') ?? stateFrom);

  const identifierRules: FormRule[] = [
    { required: true, whitespace: true, message: t('auth.validation.identifierRequired') },
    {
      // Contains "@" -> must be a valid email; otherwise accepted as a username.
      validator: (_rule, value: string) =>
        !value || isValidLoginIdentifier(value)
          ? Promise.resolve()
          : Promise.reject(new Error(t('auth.validation.emailInvalid'))),
    },
  ];

  const passwordRules: FormRule[] = [
    { required: true, message: t('auth.validation.passwordRequired') },
    {
      min: PASSWORD_MIN_LENGTH,
      message: t('auth.validation.passwordMin', { min: PASSWORD_MIN_LENGTH }),
    },
  ];

  const handleFinish = async (values: LoginFormValues) => {
    setErrorText(null);
    try {
      await mutateAsync({
        username: values.identifier.trim(),
        password: values.password,
        rememberMe: values.rememberMe,
      });
      // Toast is correct here: we leave this page immediately, so there is no
      // inline surface left to show the success on.
      message.success(t('auth.loginSuccess'));
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // error.code -> i18n; the backend's English error.message is never shown.
      // Inline Alert only — no toast on top of it (one channel per event).
      setErrorText(resolveLoginError(error));
    }
  };

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <AuthShell withBrandPanel>
      <div className={styles.header}>
        <BrandMark size="lg" centered />
        <h2 className={styles.title}>{t('auth.loginTitle')}</h2>
        <p className={styles.subtitle}>{t('auth.loginSubtitle')}</p>
      </div>

      {errorText && (
        <Alert className={styles.alert} type="error" showIcon message={errorText} role="alert" />
      )}

      <Form<LoginFormValues>
        name="login"
        layout="vertical"
        size="large"
        requiredMark={false}
        initialValues={{ rememberMe: false }}
        onFinish={handleFinish}
      >
        <Form.Item label={t('auth.identifier')} name="identifier" rules={identifierRules}>
          <Input
            prefix={<MailOutlined className={styles.inputIcon} aria-hidden="true" />}
            placeholder={t('auth.identifierPlaceholder')}
            autoComplete="username"
            autoFocus
            disabled={isPending}
          />
        </Form.Item>

        {/* Input.Password ships an accessible show/hide toggle: role="button",
            tabIndex 0, aria-pressed and a localized aria-label coming from
            ConfigProvider's locale. */}
        <Form.Item label={t('auth.password')} name="password" rules={passwordRules}>
          <Input.Password
            prefix={<LockOutlined className={styles.inputIcon} aria-hidden="true" />}
            placeholder={t('auth.passwordPlaceholder')}
            autoComplete="current-password"
            disabled={isPending}
          />
        </Form.Item>

        <div className={styles.optionsRow}>
          <Form.Item name="rememberMe" valuePropName="checked" noStyle>
            <Checkbox disabled={isPending}>{t('auth.rememberMe')}</Checkbox>
          </Form.Item>
          <Link className={styles.forgotLink} to="/forgot-password">
            {t('auth.forgotPasswordLink')}
          </Link>
        </div>

        <Form.Item className={styles.submitItem}>
          <Button type="primary" htmlType="submit" block size="large" loading={isPending}>
            {t('auth.loginButton')}
          </Button>
        </Form.Item>
      </Form>

      <SsoButtons />

      <p className={styles.cardFooter}>
        {t('auth.noAccount')} <PlaceholderLink label={t('auth.contactAdmin')} emphasis />
      </p>
    </AuthShell>
  );
}
