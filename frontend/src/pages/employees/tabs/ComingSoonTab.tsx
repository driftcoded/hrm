import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './ComingSoonTab.module.css';

/**
 * Placeholder for the detail tabs whose feature ships in a later phase
 * (lương, phép, chấm công, khen thưởng, đánh giá).
 *
 * The tab EXISTS rather than being hidden, because the eight tabs are the
 * shape of an employee record in this product — hiding five of them would make
 * the screen look finished when it is not, and re-ordering them later would move
 * the three that work. It says which phase brings the data, so the gap reads as
 * planned rather than broken. Same convention as `ComingSoonPage` in the sidebar.
 */
export interface ComingSoonTabProps {
  /** i18n key for the tab's own name. */
  titleKey: string;
  /** PLAN phase number that delivers it, e.g. `'6'`. */
  phase: string;
}

export function ComingSoonTab({ titleKey, phase }: ComingSoonTabProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.wrapper}>
      <Empty
        description={
          <div>
            <p className={styles.title}>{t('employees.tabs.comingSoonTitle', { name: t(titleKey) })}</p>
            <p className={styles.detail}>{t('employees.tabs.comingSoonDetail', { phase })}</p>
          </div>
        }
      />
    </div>
  );
}
