import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './BrandMark.module.css';

interface BrandMarkProps {
  /** `md` for the compact lockup (brand panel header), `lg` for the card header. */
  size?: 'md' | 'lg';
  /** Center the lockup (used inside the auth card). */
  centered?: boolean;
  /**
   * Drop the wordmark and keep only the mark — used by the collapsed sidebar,
   * where 80px has no room for text. The `<svg>` keeps its `aria-label`, so the
   * brand still has an accessible name with the text gone.
   */
  wordmarkHidden?: boolean;
}

/**
 * Neutral in-house brand lockup: a geometric hexagon mark + the "HRM" wordmark
 * (`t('app.name')`). Deliberately generic — this project has no third-party
 * branding and no designer-supplied logo asset yet.
 */
export function BrandMark({
  size = 'md',
  centered = false,
  wordmarkHidden = false,
}: BrandMarkProps) {
  const { t } = useTranslation();
  // Unique per instance: the same lockup renders twice on the login screen.
  const gradientId = `hrm-brand-mark-${useId()}`;
  const classes = [
    styles.lockup,
    size === 'lg' ? styles.lg : styles.md,
    centered ? styles.centered : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <svg className={styles.mark} viewBox="0 0 40 40" role="img" aria-label={t('app.name')}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {/* stop-color set from CSS so it can use design tokens */}
            <stop offset="0%" className={styles.stopFrom} />
            <stop offset="100%" className={styles.stopTo} />
          </linearGradient>
        </defs>
        {/* Hexagon */}
        <path d="M20 2.5 34.6 11v18L20 37.5 5.4 29V11z" fill={`url(#${gradientId})`} />
        {/* Abstract "H" cut out of the mark */}
        <path
          className={styles.glyph}
          d="M14.5 12.5h3.4v5.9h4.2v-5.9h3.4v15h-3.4v-6h-4.2v6h-3.4z"
        />
      </svg>
      {!wordmarkHidden && <span className={styles.wordmark}>{t('app.name')}</span>}
    </div>
  );
}
