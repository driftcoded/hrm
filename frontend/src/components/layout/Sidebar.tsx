import { useEffect, useState } from 'react';
import { Menu, Tooltip, type MenuProps } from 'antd';
import {
  BarChartOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  FileTextOutlined,
  HomeOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { BrandMark } from '@/components/common/BrandMark';
import { SETTINGS_SECTIONS } from '@/constants/settingsSections';
import {
  useCanManageSettings,
  useCanReadPayroll,
  useCanWriteMasterData,
} from '@/hooks/usePermissions';
import { useUiStore } from '@/store/uiStore';
import styles from './Sidebar.module.css';

interface NavChild {
  key: string;
  labelKey: string;
  /** Mirrors `SettingsSection.adminOnly` — hidden unless `useCanManageSettings()`. */
  adminOnly?: boolean;
}

interface NavItem {
  key: string;
  icon: ReactNode;
  labelKey: string;
  children?: NavChild[];
}

/**
 * Business modules only. `/profile` is deliberately absent — it is reached from
 * the header user dropdown, and mixing a personal page into the module list
 * makes the navigation read inconsistently.
 *
 * Modules that ship in a later phase still route to a real placeholder page
 * (see routes/RouterConfig.tsx) rather than a dead link.
 *
 * "Phòng ban" is no longer a top-level item: departments are master data and live
 * under Cài đặt with the other four master-data screens (Giai đoạn 2.2). Listing
 * it twice would give one page two homes in the navigation.
 */
const NAV_ITEMS: NavItem[] = [
  { key: '/dashboard', icon: <HomeOutlined />, labelKey: 'nav.dashboard' },
  { key: '/employees', icon: <TeamOutlined />, labelKey: 'nav.employees' },
  { key: '/attendance', icon: <ClockCircleOutlined />, labelKey: 'nav.attendance' },
  { key: '/payroll', icon: <DollarCircleOutlined />, labelKey: 'nav.payroll' },
  { key: '/leave', icon: <FileTextOutlined />, labelKey: 'nav.leave' },
  { key: '/reports', icon: <BarChartOutlined />, labelKey: 'nav.reports' },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    labelKey: 'nav.settings',
    children: SETTINGS_SECTIONS.map((section) => ({
      key: section.path,
      labelKey: section.titleKey,
      adminOnly: section.adminOnly,
    })),
  },
];

/** Longest-prefix match, so `/employees/42` keeps its parent item highlighted. */
function matchNavKey(pathname: string, keys: string[]): string | undefined {
  return keys
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** The submenu that contains the current route, if any. */
function activeParentKey(pathname: string): string | undefined {
  return NAV_ITEMS.find(
    (item) =>
      item.children && matchNavKey(pathname, [item.key, ...item.children.map((c) => c.key)]),
  )?.key;
}

interface SidebarProps {
  /** Called after a nav click — used by the mobile Drawer to close itself. */
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  /**
   * Cài đặt is hidden from roles that cannot change master data
   * (`manager`, `employee`) — the same three roles the backend lets write are the
   * ones offered the menu. Hiding the entry is NOT a security boundary: the routes
   * stay reachable by URL and render read-only for those roles (the API is what
   * actually refuses writes).
   */
  const canWriteMasterData = useCanWriteMasterData();
  const canManageSettings = useCanManageSettings();
  /*
   * `manager` không đọc được bảng lương (backend từ chối mọi endpoint của phân
   * hệ này). Để mục Bảng lương trong menu thì họ bấm vào và nhận một màn hình
   * toàn 403 — bày ra một lối đi chắc chắn cụt.
   */
  const canReadPayroll = useCanReadPayroll();
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.key === '/settings') {
      return canWriteMasterData;
    }

    if (item.key === '/payroll') {
      return canReadPayroll;
    }

    return true;
  });

  // The Drawer always renders the full sidebar, even while the persisted
  // `sidebarCollapsed` flag is what opened it.
  const collapsed = sidebarCollapsed && !onNavigate;

  const items: MenuProps['items'] = visibleItems.map(({ key, icon, labelKey, children }) => ({
    key,
    icon,
    label: t(labelKey),
    children: children
      ?.filter((child) => !child.adminOnly || canManageSettings)
      .map((child) => ({ key: child.key, label: t(child.labelKey) })),
  }));

  const allKeys = visibleItems.flatMap((item) => [
    item.key,
    ...(item.children?.map((child) => child.key) ?? []),
  ]);
  const selectedKey = matchNavKey(location.pathname, allKeys);

  /**
   * `openKeys` is controlled so that landing on `/settings/holidays` from a link
   * or the browser address bar expands Cài đặt, not only clicking the submenu. It
   * stays user-controllable: `onOpenChange` still wins, so the submenu can be
   * folded away while a settings page is open.
   */
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const parent = activeParentKey(location.pathname);
    return parent ? [parent] : [];
  });

  useEffect(() => {
    const parent = activeParentKey(location.pathname);
    if (parent) {
      setOpenKeys((previous) => (previous.includes(parent) ? previous : [...previous, parent]));
    }
  }, [location.pathname]);

  const CollapseIcon = collapsed ? DoubleRightOutlined : DoubleLeftOutlined;
  const collapseLabel = collapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar');

  return (
    <nav className={styles.sidebar} aria-label={t('layout.navigation')}>
      <div className={collapsed ? `${styles.brand} ${styles.brandCollapsed}` : styles.brand}>
        <BrandMark size="md" wordmarkHidden={collapsed} />
      </div>

      <Menu
        className={styles.menu}
        mode="inline"
        theme="dark"
        inlineCollapsed={collapsed}
        selectedKeys={selectedKey ? [selectedKey] : []}
        // A collapsed inline Menu renders submenus as popups and manages their
        // open state itself, so the controlled value only applies when expanded.
        openKeys={collapsed ? undefined : openKeys}
        onOpenChange={(keys) => setOpenKeys(keys as string[])}
        items={items}
        onClick={({ key }) => {
          navigate(key);
          onNavigate?.();
        }}
      />

      {/* The Drawer has its own close affordance, so no collapse row there. */}
      {!onNavigate && (
        <div className={styles.footer}>
          <Tooltip title={collapsed ? collapseLabel : ''} placement="right">
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleSidebar}
              aria-label={collapseLabel}
            >
              <CollapseIcon className={styles.collapseIcon} />
              {!collapsed && <span>{t('layout.collapse')}</span>}
            </button>
          </Tooltip>
        </div>
      )}
    </nav>
  );
}
