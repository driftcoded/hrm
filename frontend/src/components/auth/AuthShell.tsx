import type { ReactNode } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { BrandPanel } from './BrandPanel';
import { PlaceholderLink } from './PlaceholderLink';
import styles from './AuthShell.module.css';

interface AuthShellProps {
  children: ReactNode;
  /** Show the left brand/marketing column — login screen only. */
  withBrandPanel?: boolean;
}

/**
 * Shared chrome for every unauthenticated screen: soft blue gradient
 * background, optional left brand column (~58%), centered white card on the
 * right and a slim full-width footer bar.
 *
 * Responsive (docs/ui-conventions.md §10): below 768px the brand column is
 * hidden and the card goes full width.
 */
export function AuthShell({ children, withBrandPanel = false }: AuthShellProps) {
  const { t } = useTranslation();
  // dayjs only — never `new Date()` (frontend/CLAUDE.md).
  const year = dayjs().year();

  return (
    <div className={styles.root}>
      <main className={withBrandPanel ? styles.main : `${styles.main} ${styles.mainCentered}`}>
        {withBrandPanel && (
          <section className={styles.brandColumn}>
            <BrandPanel />
          </section>
        )}
        <section className={styles.formColumn}>
          <div className={styles.card}>{children}</div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.copyright}>
          {t('auth.footer.copyright', { year, app: t('app.name') })}
        </span>
        <span className={styles.footerLinks}>
          <PlaceholderLink label={t('auth.footer.privacy')} />
          <PlaceholderLink label={t('auth.footer.terms')} />
        </span>
      </footer>
    </div>
  );
}
