import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './PlaceholderLink.module.css';

interface PlaceholderLinkProps {
  /** Already-translated label. */
  label: string;
  /** `true` renders it in the primary color (in-card links), `false` = muted footer link. */
  emphasis?: boolean;
}

/**
 * A link the design calls for but that has NO destination yet (privacy policy,
 * terms of use, "contact the administrator").
 *
 * We deliberately do NOT render a functional-looking anchor that goes nowhere:
 * it is focusable and announces "(sắp có)" to screen readers, and shows a
 * "Sắp có" tooltip on hover/focus. Replace with a real `<Link>` once the
 * destination pages exist.
 */
export function PlaceholderLink({ label, emphasis = false }: PlaceholderLinkProps) {
  const { t } = useTranslation();

  return (
    <Tooltip title={t('common.comingSoon')}>
      <span
        className={emphasis ? `${styles.link} ${styles.emphasis}` : styles.link}
        tabIndex={0}
        aria-disabled="true"
        aria-label={t('common.comingSoonAria', { label })}
      >
        {label}
      </span>
    </Tooltip>
  );
}
