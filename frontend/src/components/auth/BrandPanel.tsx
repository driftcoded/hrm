import type { ReactNode } from 'react';
import { ClockCircleOutlined, DollarOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { BrandIllustration } from './BrandIllustration';
import { BrandMark } from '@/components/common/BrandMark';
import styles from './BrandPanel.module.css';

interface FeatureRow {
  key: string;
  icon: ReactNode;
  /** Tinted tile background: blue / green / purple. */
  tone: 'primary' | 'success' | 'accent';
}

const FEATURES: FeatureRow[] = [
  { key: 'records', icon: <TeamOutlined />, tone: 'primary' },
  { key: 'attendance', icon: <ClockCircleOutlined />, tone: 'success' },
  { key: 'payroll', icon: <DollarOutlined />, tone: 'accent' },
];

const TONE_CLASS: Record<FeatureRow['tone'], string> = {
  primary: styles.tilePrimary,
  success: styles.tileSuccess,
  accent: styles.tileAccent,
};

/**
 * Marketing / brand column of the auth screens (left ~58%).
 * All copy is original to this project and comes from i18n
 * (`auth.brand.*`) — no third-party product text or artwork is reproduced.
 * Hidden below 768px per docs/ui-conventions.md §10.
 */
export function BrandPanel() {
  const { t } = useTranslation();

  return (
    <div className={styles.panel}>
      <BrandMark />

      <div className={styles.content}>
        <p className={styles.badge}>
          <SafetyCertificateOutlined className={styles.badgeIcon} aria-hidden="true" />
          <span>{t('auth.brand.badge')}</span>
        </p>

        <h1 className={styles.headline}>
          <span className={styles.headlineLine}>{t('auth.brand.headlineLine1')}</span>
          <span className={styles.headlineLine}>
            {t('auth.brand.headlineLine2')} <span className={styles.headlineAccent}>{t('auth.brand.headlineAccent')}</span>
          </span>
        </h1>

        <p className={styles.description}>{t('auth.brand.description')}</p>

        <ul className={styles.features}>
          {FEATURES.map(({ key, icon, tone }) => (
            <li className={styles.feature} key={key}>
              <span className={`${styles.tile} ${TONE_CLASS[tone]}`} aria-hidden="true">
                {icon}
              </span>
              <span className={styles.featureText}>
                <span className={styles.featureTitle}>{t(`auth.brand.features.${key}.title`)}</span>
                <span className={styles.featureDescription}>
                  {t(`auth.brand.features.${key}.description`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.illustration}>
        <BrandIllustration />
      </div>
    </div>
  );
}
