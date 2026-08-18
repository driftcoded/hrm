import { useEffect } from 'react';
import { Dropdown, Tabs, type MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { HOME_PATH, matchRoute, routeTitleKey } from '@/constants/routeTitles';
import { useTabsStore } from '@/store/tabsStore';
import styles from './NavTabs.module.css';

/**
 * Open-pages bar under the header — lets someone keep several modules open and
 * switch between them without losing their place, the way a desktop app does.
 *
 * Note this is navigation state, not view state: switching tabs is a route
 * change, so a tab does NOT preserve the scroll position or unsaved form state
 * of the page it points at. Making tabs keep live component state would mean
 * mounting every open route at once, which is a much bigger change than the
 * convenience is worth right now.
 */
export function NavTabs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = useTabsStore((state) => state.tabs);
  const openTab = useTabsStore((state) => state.openTab);
  const closeTab = useTabsStore((state) => state.closeTab);
  const closeOthers = useTabsStore((state) => state.closeOthers);
  const closeAll = useTabsStore((state) => state.closeAll);

  const activePath = matchRoute(location.pathname) ?? location.pathname;

  // Every visited route registers itself, so the bar reflects real navigation
  // (including deep links and browser Back) rather than only tab clicks.
  useEffect(() => {
    const titleKey = routeTitleKey(location.pathname);
    if (titleKey) {
      openTab({ path: activePath, titleKey });
    }
  }, [activePath, location.pathname, openTab]);

  // Nothing worth showing until a second page has been opened.
  if (tabs.length < 2) {
    return null;
  }

  const contextMenu: MenuProps['items'] = [
    {
      key: 'closeOthers',
      label: t('tabs.closeOthers'),
      onClick: () => closeOthers(activePath),
    },
    {
      key: 'closeAll',
      label: t('tabs.closeAll'),
      onClick: () => {
        closeAll();
        navigate(HOME_PATH);
      },
    },
  ];

  return (
    <div className={styles.wrapper}>
      <Tabs
        className={styles.tabs}
        type="card"
        size="small"
        activeKey={activePath}
        onChange={(key) => navigate(key)}
        onEdit={(targetKey, action) => {
          if (action !== 'remove' || typeof targetKey !== 'string') {
            return;
          }
          const next = closeTab(targetKey, activePath);
          if (next) {
            navigate(next);
          }
        }}
        hideAdd
        items={tabs.map((tab) => ({
          key: tab.path,
          label: t(tab.titleKey),
          // Home is the anchor of the bar — closing it would leave nowhere to
          // fall back to.
          closable: tab.path !== HOME_PATH,
        }))}
      />
      <Dropdown menu={{ items: contextMenu }} trigger={['click']} placement="bottomRight">
        <button type="button" className={styles.moreButton} aria-label={t('tabs.actions')}>
          ⋯
        </button>
      </Dropdown>
    </div>
  );
}
