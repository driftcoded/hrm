import { Card } from 'antd';
import { MailOutlined, PictureOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SETTINGS_SECTIONS } from '@/constants/navSections';
import { useCanManageSettings } from '@/hooks/usePermissions';
import styles from './SettingsIndexPage.module.css';

/**
 * `/settings` — chỉ mục CẤU HÌNH HỆ THỐNG.
 *
 * Danh mục nghiệp vụ (phòng ban, chức vụ, loại phép…) đã rời sang `/catalog`;
 * ở đây chỉ còn thứ cài một lần lúc dựng hệ thống. Danh sách thẻ sinh từ
 * `constants/navSections.ts`, cùng registry mà sidebar đọc.
 */
const SECTION_ICONS: Record<string, ReactNode> = {
  branding: <PictureOutlined />,
  mail: <MailOutlined />,
};

export function SettingsIndexPage() {
  const { t } = useTranslation();
  const canManageSettings = useCanManageSettings();
  const visibleSections = SETTINGS_SECTIONS.filter(
    (section) => !section.adminOnly || canManageSettings,
  );

  return (
    <>
      <PageHeader
        title={t('nav.settings')}
        subtitle={
          canManageSettings
            ? t('settings.index.subtitle')
            : t('settings.index.subtitleReadOnly')
        }
      />

      <div className={styles.grid}>
        {visibleSections.map((section) => (
          <Link key={section.path} to={section.path} className={styles.cardLink}>
            <Card variant="borderless" className={styles.card} hoverable>
              <span className={styles.icon} aria-hidden="true">
                {SECTION_ICONS[section.id]}
              </span>
              <span className={styles.cardTitle}>{t(section.titleKey)}</span>
              <span className={styles.cardText}>{t(section.descriptionKey)}</span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
