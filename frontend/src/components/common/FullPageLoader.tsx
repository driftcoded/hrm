import { Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './FullPageLoader.module.css';

/**
 * Full-viewport loading placeholder for route-level waits (lazy chunk loading,
 * silent session restore). Uses `Skeleton` rather than `Spin` per
 * docs/ui-conventions.md §7 ("Không dùng Spin cho trang").
 */
export function FullPageLoader() {
  const { t } = useTranslation();

  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{t('common.loading')}</span>
      <div className={styles.panel}>
        <Skeleton active paragraph={{ rows: 4 }} title />
      </div>
    </div>
  );
}
