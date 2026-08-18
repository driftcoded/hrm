import type { ReactNode } from 'react';
import { Button, Divider, Tooltip } from 'antd';
import { GoogleOutlined, WindowsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './SsoButtons.module.css';

interface SsoProvider {
  key: string;
  labelKey: string;
  icon: ReactNode;
}

const PROVIDERS: SsoProvider[] = [
  { key: 'google', labelKey: 'auth.sso.google', icon: <GoogleOutlined /> },
  { key: 'microsoft', labelKey: 'auth.sso.microsoft', icon: <WindowsOutlined /> },
];

/**
 * Social sign-in block from the reference design.
 *
 * IMPORTANT: both buttons are permanently `disabled`. The backend has no OAuth
 * endpoints and SSO is not in PLAN.md, so rendering a button that looks
 * functional but silently does nothing would be a lie. Each is wrapped in a
 * "Sắp có" tooltip (the wrapper span is required because a disabled button
 * emits no mouse events for the tooltip to hook into).
 */
export function SsoButtons() {
  const { t } = useTranslation();

  return (
    <div className={styles.root}>
      <Divider className={styles.divider} plain>
        {t('auth.orDivider')}
      </Divider>
      <div className={styles.buttons}>
        {PROVIDERS.map(({ key, labelKey, icon }) => {
          const label = t(labelKey);
          return (
            <Tooltip key={key} title={t('common.comingSoon')}>
              <span className={styles.buttonWrapper}>
                <Button
                  block
                  size="large"
                  disabled
                  icon={icon}
                  aria-label={t('common.comingSoonAria', { label })}
                >
                  {label}
                </Button>
              </span>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
