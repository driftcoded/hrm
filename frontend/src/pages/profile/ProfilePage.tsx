import { useState } from 'react';
import { Alert, App, Avatar, Button, Card, Descriptions, Form, Input, Skeleton, type FormRule } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChangePassword, useCurrentUser } from '@/hooks/useAuth';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAuthStore } from '@/store/authStore';
import { PASSWORD_MIN_LENGTH, type ChangePasswordFormValues } from '@/types/auth.types';
import { getUserDisplayName, roleI18nKey } from '@/utils/user';
import styles from './ProfilePage.module.css';

/**
 * `/profile` — current user info (`GET /auth/me`) + change password
 * (`POST /auth/change-password`).
 *
 * Changing the password revokes every session server-side, so on success we
 * drop local auth state and send the user back to /login.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const { user, isLoading, isError, refetch } = useCurrentUser();
  const { mutateAsync, isPending } = useChangePassword();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const [errorText, setErrorText] = useState<string | null>(null);

  const newPasswordRules: FormRule[] = [
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

  const handleFinish = async (values: ChangePasswordFormValues) => {
    setErrorText(null);
    try {
      await mutateAsync(values);
      form.resetFields();
      // Toast is correct here: we redirect to /login, so this card is gone.
      message.success(t('profile.changePasswordSuccess'));
      // All sessions were revoked server-side — force a fresh login.
      clearAuth();
      queryClient.clear();
      navigate('/login', { replace: true });
    } catch (error) {
      // WRONG_CURRENT_PASSWORD / PASSWORD_MISMATCH etc. shown inline in the
      // card only — no toast on top of it.
      setErrorText(resolveError(error));
    }
  };

  return (
    <>
      <PageHeader title={t('profile.title')} />

      <div className={styles.grid}>
        <Card title={t('profile.infoTitle')} className={styles.card}>
          {isLoading && <Skeleton active avatar paragraph={{ rows: 4 }} />}

          {!isLoading && isError && (
            <Alert
              type="error"
              showIcon
              message={t('profile.loadError')}
              action={
                <Button size="small" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          )}

          {!isLoading && !isError && user && (
            <>
              <div className={styles.identity}>
                <Avatar
                  size={64}
                  src={user.employee?.avatarUrl ?? undefined}
                  icon={<UserOutlined />}
                  alt={getUserDisplayName(user)}
                />
                <div className={styles.identityText}>
                  <span className={styles.displayName}>{getUserDisplayName(user)}</span>
                  <span className={styles.roleLabel}>
                    {t(roleI18nKey(user.role), { defaultValue: user.role })}
                  </span>
                </div>
              </div>

              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'username',
                    label: t('profile.username'),
                    children: user.username,
                  },
                  { key: 'email', label: t('profile.email'), children: user.email },
                  {
                    key: 'employee',
                    label: t('profile.employeeName'),
                    children: user.employee?.fullName ?? t('profile.noEmployeeLink'),
                  },
                ]}
              />
            </>
          )}
        </Card>

        <Card title={t('profile.changePasswordTitle')} className={styles.card}>
          <p className={styles.hint}>{t('profile.changePasswordHint')}</p>
          {errorText && (
            <Alert
              className={styles.formAlert}
              type="error"
              showIcon
              message={errorText}
              role="alert"
            />
          )}
          <Form<ChangePasswordFormValues>
            form={form}
            name="changePassword"
            layout="vertical"
            onFinish={handleFinish}
          >
            <Form.Item
              label={t('profile.currentPassword')}
              name="currentPassword"
              rules={[{ required: true, message: t('auth.validation.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined className={styles.inputIcon} aria-hidden="true" />}
                placeholder={t('profile.currentPasswordPlaceholder')}
                autoComplete="current-password"
                disabled={isPending}
              />
            </Form.Item>

            <Form.Item
              label={t('profile.newPassword')}
              name="newPassword"
              rules={newPasswordRules}
            >
              <Input.Password
                prefix={<LockOutlined className={styles.inputIcon} aria-hidden="true" />}
                placeholder={t('auth.newPasswordPlaceholder')}
                autoComplete="new-password"
                disabled={isPending}
              />
            </Form.Item>

            <Form.Item
              label={t('profile.confirmPassword')}
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

            <Form.Item className={styles.actions}>
              <Button type="primary" htmlType="submit" loading={isPending}>
                {t('profile.changePasswordSubmit')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
}
