import { Alert, App, Button, Card, Form, Input, Skeleton } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { BrandAssetUploader } from '@/components/settings/BrandAssetUploader';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useBranding,
  useRemoveFavicon,
  useRemoveLogo,
  useUpdateCompanyName,
  useUploadFavicon,
  useUploadLogo,
} from '@/hooks/useBranding';
import { useCanManageSettings } from '@/hooks/usePermissions';
import styles from './BrandingSettingsPage.module.css';

interface CompanyNameFormValues {
  companyName: string;
}

/**
 * `/settings/branding` — company name + logo + favicon, admin only.
 *
 * `GET /settings/branding` is public (the login page reads it too, via
 * `BrandMark`), but every mutation here is admin-gated by the backend; the
 * form controls are hidden for anyone else, matching how the other settings
 * screens go read-only for roles that cannot write (§Giai đoạn 2.2 note in
 * `constants/navSections.ts`).
 */
export function BrandingSettingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const canManage = useCanManageSettings();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<CompanyNameFormValues>();

  const { data: branding, isLoading, isError, refetch } = useBranding();
  const updateCompanyName = useUpdateCompanyName();
  const uploadLogo = useUploadLogo();
  const removeLogo = useRemoveLogo();
  const uploadFavicon = useUploadFavicon();
  const removeFavicon = useRemoveFavicon();

  useEffect(() => {
    if (branding) {
      form.setFieldsValue({ companyName: branding.companyName });
    }
  }, [branding, form]);

  const handleSubmit = async (values: CompanyNameFormValues) => {
    try {
      await updateCompanyName.mutateAsync({ companyName: values.companyName });
      message.success(t('settings.branding.saveSuccess'));
    } catch (error) {
      message.error(resolveError(error));
    }
  };

  const handleAssetAction = async (action: Promise<unknown>, successKey: string) => {
    try {
      await action;
      message.success(t(successKey));
    } catch (error) {
      message.error(resolveError(error));
      // Re-throw so BrandAssetUploader's `.catch()` sees a real rejection —
      // matches AvatarUploader.onUpload's contract elsewhere in the app.
      throw error;
    }
  };

  return (
    <>
      <PageHeader
        title={t('settings.branding.pageTitle')}
        subtitle={
          canManage
            ? t('settings.branding.subtitle')
            : t('settings.index.subtitleReadOnly')
        }
      />

      {isLoading && (
        <Card className={styles.card}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      )}

      {!isLoading && isError && (
        <Alert
          type="error"
          showIcon
          title={t('settings.branding.loadError')}
          action={
            <Button size="small" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && branding && (
        <div className={styles.grid}>
          <Card title={t('settings.branding.companyNameTitle')} className={styles.card}>
            <Form<CompanyNameFormValues>
              form={form}
              layout="vertical"
              onFinish={(values) => void handleSubmit(values)}
              disabled={!canManage}
            >
              <Form.Item
                label={t('settings.branding.companyName')}
                name="companyName"
                rules={[
                  { required: true, message: t('settings.validation.nameRequired') },
                  { max: 150, message: t('settings.validation.nameTooLong') },
                ]}
              >
                <Input placeholder={t('settings.branding.companyNamePlaceholder')} />
              </Form.Item>

              {canManage && (
                <Form.Item className={styles.actions}>
                  <Button type="primary" htmlType="submit" loading={updateCompanyName.isPending}>
                    {t('common.save')}
                  </Button>
                </Form.Item>
              )}
            </Form>
          </Card>

          {canManage && (
            <>
              <Card title={t('settings.branding.logoTitle')} className={styles.card}>
                <BrandAssetUploader
                  label={t('settings.branding.logoTitle')}
                  hint={t('settings.branding.logoHint')}
                  currentUrl={branding.logoUrl}
                  isUploading={uploadLogo.isPending}
                  isRemoving={removeLogo.isPending}
                  onUpload={(file) =>
                    handleAssetAction(
                      uploadLogo.mutateAsync(file),
                      'settings.branding.logoUploadSuccess',
                    )
                  }
                  onRemove={() =>
                    handleAssetAction(
                      removeLogo.mutateAsync(),
                      'settings.branding.logoRemoveSuccess',
                    )
                  }
                />
              </Card>

              <Card title={t('settings.branding.faviconTitle')} className={styles.card}>
                <BrandAssetUploader
                  label={t('settings.branding.faviconTitle')}
                  hint={t('settings.branding.faviconHint')}
                  currentUrl={branding.faviconUrl}
                  isUploading={uploadFavicon.isPending}
                  isRemoving={removeFavicon.isPending}
                  onUpload={(file) =>
                    handleAssetAction(
                      uploadFavicon.mutateAsync(file),
                      'settings.branding.faviconUploadSuccess',
                    )
                  }
                  onRemove={() =>
                    handleAssetAction(
                      removeFavicon.mutateAsync(),
                      'settings.branding.faviconRemoveSuccess',
                    )
                  }
                />
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
