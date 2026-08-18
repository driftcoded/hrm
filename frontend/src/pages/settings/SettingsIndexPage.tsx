import { Card } from 'antd';
import {
  ApartmentOutlined,
  CalendarOutlined,
  FileProtectOutlined,
  IdcardOutlined,
  SunOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { SETTINGS_SECTIONS } from '@/constants/settingsSections';
import { useCanWriteMasterData } from '@/hooks/usePermissions';
import styles from './SettingsIndexPage.module.css';

/**
 * `/settings` — the index of the master-data section.
 *
 * The card list is generated from `constants/settingsSections.ts`, the same
 * registry the sidebar submenu reads, so a new settings screen appears in both
 * places from one edit.
 */
const SECTION_ICONS: Record<string, ReactNode> = {
  departments: <ApartmentOutlined />,
  positions: <IdcardOutlined />,
  'contract-types': <FileProtectOutlined />,
  'leave-types': <SunOutlined />,
  holidays: <CalendarOutlined />,
};

export function SettingsIndexPage() {
  const { t } = useTranslation();
  const canWrite = useCanWriteMasterData();

  return (
    <>
      <PageHeader
        title={t('nav.settings')}
        subtitle={canWrite ? t('settings.index.subtitle') : t('settings.index.subtitleReadOnly')}
      />

      <div className={styles.grid}>
        {SETTINGS_SECTIONS.map((section) => (
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
