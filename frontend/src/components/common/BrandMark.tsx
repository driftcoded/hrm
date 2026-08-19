import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useBranding } from '@/hooks/useBranding';
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
 * Brand lockup: a company-uploaded logo + name when configured
 * (`/settings/branding`, admin only), falling back to the neutral in-house
 * hexagon mark + `t('app.name')` otherwise — including while the branding
 * query is still loading, so nothing flashes empty on first paint.
 */
export function BrandMark({
  size = 'md',
  centered = false,
  wordmarkHidden = false,
}: BrandMarkProps) {
  const { t } = useTranslation();
  const { data: branding } = useBranding();
  // Unique per instance: the same lockup renders twice on the login screen.
  const gradientId = `hrm-brand-mark-${useId()}`;
  const classes = [
    styles.lockup,
    size === 'lg' ? styles.lg : styles.md,
    centered ? styles.centered : '',
  ]
    .filter(Boolean)
    .join(' ');

  const companyName = branding?.companyName || t('app.name');

  return (
    <div className={classes}>
      {branding?.logoUrl ? (
        <img className={styles.mark} src={branding.logoUrl} alt={companyName} />
      ) : (
        <svg className={styles.mark} viewBox="0 0 40 40" role="img" aria-label={companyName}>
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
      )}
      {!wordmarkHidden && <span className={styles.wordmark}>{companyName}</span>}
    </div>
  );
}
