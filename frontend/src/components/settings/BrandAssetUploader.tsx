import { Alert, Button, Image, Popconfirm, Space, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { DeleteOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './BrandAssetUploader.module.css';

/** Mirrors the server's `AVATAR_MAX_BYTES` — logo/favicon reuse that same cap. */
export const BRAND_ASSET_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface BrandAssetUploaderProps {
  label: string;
  hint: string;
  currentUrl: string | null;
  onUpload: (file: File) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  isUploading: boolean;
  isRemoving: boolean;
  disabled?: boolean;
}

/**
 * Logo/favicon picker: unlike `AvatarUploader`, there is no "preview then
 * confirm" staging step — a settings screen isn't a multi-step wizard the
 * user might abandon, so picking a file uploads it right away. `onRemove`
 * clears the ALREADY-SAVED asset (something `AvatarUploader` has no
 * equivalent for, since employees have no "remove avatar" endpoint).
 */
export function BrandAssetUploader({
  label,
  hint,
  currentUrl,
  onUpload,
  onRemove,
  isUploading,
  isRemoving,
  disabled = false,
}: BrandAssetUploaderProps) {
  const { t } = useTranslation();
  const [localError, setLocalError] = useState<string | null>(null);

  const beforeUpload: UploadProps['beforeUpload'] = (picked) => {
    setLocalError(null);

    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setLocalError(t('settings.branding.assetInvalidType'));
      return Upload.LIST_IGNORE;
    }
    if (picked.size > BRAND_ASSET_MAX_BYTES) {
      setLocalError(t('settings.branding.assetTooLarge'));
      return Upload.LIST_IGNORE;
    }

    void onUpload(picked as unknown as File).catch(() => {
      // The parent already toasts the real API error (see
      // BrandingSettingsPage's handleAssetAction) and re-throws only so this
      // rejection is real — swallow it here purely to avoid an "unhandled
      // promise rejection" console warning.
    });
    return false;
  };

  const busy = isUploading || isRemoving || disabled;

  return (
    <div className={styles.uploader}>
      <div className={styles.preview}>
        {currentUrl ? (
          <Image src={currentUrl} alt={label} width={64} height={64} className={styles.image} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <PictureOutlined />
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <span className={styles.label}>{label}</span>

        <Space wrap>
          <Upload
            accept={ACCEPTED_TYPES.join(',')}
            beforeUpload={beforeUpload}
            showUploadList={false}
            maxCount={1}
            disabled={busy}
          >
            <Button icon={<UploadOutlined />} loading={isUploading} disabled={busy}>
              {t('settings.branding.assetChoose')}
            </Button>
          </Upload>

          {currentUrl && (
            <Popconfirm
              title={t('settings.branding.assetRemoveConfirm')}
              onConfirm={() => void onRemove()}
              okText={t('common.yes')}
              cancelText={t('common.no')}
              disabled={busy}
            >
              <Button icon={<DeleteOutlined />} loading={isRemoving} disabled={busy} danger>
                {t('settings.branding.assetRemove')}
              </Button>
            </Popconfirm>
          )}
        </Space>

        <p className={styles.hint}>{hint}</p>

        {localError && (
          <Alert type="error" showIcon title={localError} className={styles.error} />
        )}
      </div>
    </div>
  );
}
