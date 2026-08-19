import { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Button, Space, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { DeleteOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './AvatarUploader.module.css';

/**
 * Avatar picker with a real preview before anything is uploaded.
 *
 * `beforeUpload` returns `false` so AntD never performs its own request — the
 * file is held in state, previewed from a local object URL, and only sent when
 * the user confirms. That is the whole point: "preview trước khi lưu" means the
 * user sees the picture they picked and can change their mind at no cost.
 *
 * Two things this component is careful about:
 *
 * 1. **Object URLs are revoked.** `URL.createObjectURL` pins the file in memory
 *    until it is released; without the cleanup below, picking ten photos in a
 *    row leaks all ten.
 * 2. **Client-side checks are a courtesy, not a guard.** Size and type are
 *    re-validated on the server against the file's magic bytes, so a renamed
 *    `.php` is refused there whatever this code thinks. Checking here only saves
 *    the user a pointless round trip.
 */

/** Mirrors the server's `AVATAR_MAX_BYTES` default. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface AvatarUploaderProps {
  /** Current stored avatar; shown until a new file is picked. */
  currentUrl: string | null;
  /** Called with the confirmed file. Resolves when the upload finished. */
  onUpload: (file: File) => Promise<unknown>;
  isUploading: boolean;
  disabled?: boolean;
  size?: number;
}

export function AvatarUploader({
  currentUrl,
  onUpload,
  isUploading,
  disabled = false,
  size = 96,
}: AvatarUploaderProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  // Kept in a ref as well so the unmount cleanup sees the latest URL without
  // re-running the effect (and revoking a URL that is still on screen).
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    previewRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(
    () => () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    },
    [],
  );

  const replacePreview = (next: File | null) => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    const url = next ? URL.createObjectURL(next) : null;
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(next);
  };

  const beforeUpload: UploadProps['beforeUpload'] = (picked) => {
    setLocalError(null);

    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setLocalError(t('employees.avatar.invalidType'));
      return Upload.LIST_IGNORE;
    }
    if (picked.size > AVATAR_MAX_BYTES) {
      setLocalError(t('employees.avatar.tooLarge'));
      return Upload.LIST_IGNORE;
    }

    replacePreview(picked as unknown as File);
    // `false` = keep the file locally; the confirm button does the upload.
    return false;
  };

  const handleConfirm = async () => {
    if (!file) {
      return;
    }
    await onUpload(file);
    // Only clear after a SUCCESSFUL upload: if it throws, the preview stays so
    // the user can retry without picking the file again.
    replacePreview(null);
  };

  const shownUrl = previewUrl ?? currentUrl ?? undefined;

  return (
    <div className={styles.uploader}>
      <Avatar size={size} src={shownUrl} icon={<UserOutlined />} />

      <div className={styles.controls}>
        <Space wrap>
          <Upload
            accept={ACCEPTED_TYPES.join(',')}
            beforeUpload={beforeUpload}
            showUploadList={false}
            maxCount={1}
            disabled={disabled || isUploading}
          >
            <Button icon={<UploadOutlined />} disabled={disabled || isUploading}>
              {t('employees.avatar.choose')}
            </Button>
          </Upload>

          {file && (
            <>
              <Button
                type="primary"
                loading={isUploading}
                onClick={() => void handleConfirm()}
                disabled={disabled}
              >
                {t('employees.avatar.save')}
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => replacePreview(null)}
                disabled={isUploading}
              >
                {t('common.cancel')}
              </Button>
            </>
          )}
        </Space>

        <p className={styles.hint}>{t('employees.avatar.hint')}</p>

        {file && <p className={styles.previewNote}>{t('employees.avatar.previewNote')}</p>}

        {localError && (
          <Alert type="error" showIcon title={localError} className={styles.error} />
        )}
      </div>
    </div>
  );
}
