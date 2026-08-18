import { Menu, Tooltip, type MenuProps } from 'antd';
import {
  ApartmentOutlined,
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
import { useUiStore } from '@/store/uiStore';
import styles from './Sidebar.module.css';

interface NavItem {
  key: string;
  icon: ReactNode;
  labelKey: string;
}

/**
 * Business modules only. `/profile` is deliberately absent — it is reached from
 * the header user dropdown, and mixing a personal page into the module list
 * makes the navigation read inconsistently.
 *
 * Modules that ship in a later phase still route to a real placeholder page
 * (see routes/RouterConfig.tsx) rather than a dead link.
 */
const NAV_ITEMS: NavItem[] = [
  { key: '/dashboard', icon: <HomeOutlined />, labelKey: 'nav.dashboard' },
  { key: '/employees', icon: <TeamOutlined />, labelKey: 'nav.employees' },
  { key: '/departments', icon: <ApartmentOutlined />, labelKey: 'nav.departments' },
  { key: '/attendance', icon: <ClockCircleOutlined />, labelKey: 'nav.attendance' },
  { key: '/payroll', icon: <DollarCircleOutlined />, labelKey: 'nav.payroll' },
  { key: '/leave', icon: <FileTextOutlined />, labelKey: 'nav.leave' },
  { key: '/reports', icon: <BarChartOutlined />, labelKey: 'nav.reports' },
  { key: '/settings', icon: <SettingOutlined />, labelKey: 'nav.settings' },
];

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

  // The Drawer always renders the full sidebar, even while the persisted
  // `sidebarCollapsed` flag is what opened it.
  const collapsed = sidebarCollapsed && !onNavigate;

  const items: MenuProps['items'] = NAV_ITEMS.map(({ key, icon, labelKey }) => ({
    key,
    icon,
    label: t(labelKey),
  }));

  /**
   * Longest-prefix match so a nested route (e.g. `/employees/42`) keeps its
   * parent item highlighted. Exact `pathname` matching would leave the whole
   * menu unselected on every detail page.
   */
  const selectedKey = NAV_ITEMS.map((item) => item.key)
    .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];

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
