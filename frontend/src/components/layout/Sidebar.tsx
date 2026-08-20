import { useEffect, useState } from 'react';
import { Menu, Tooltip, type MenuProps } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DollarCircleOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
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

interface NavGroup {
  /** Not a route — only a heading, so it must not collide with any path. */
  key: string;
  labelKey: string;
  items: NavItem[];
}

/**
 * Điều hướng chia theo NHÓM CÔNG VIỆC, không phải một danh sách phẳng.
 *
 * Thứ tự trong nhóm "Công & lương" là thứ tự dữ liệu chảy: chấm công và nghỉ
 * phép là đầu vào của bảng lương, nên đọc từ trên xuống chính là đọc quy trình.
 *
 * `/profile` cố tình không có ở đây — nó vào từ dropdown người dùng trên header;
 * trộn một trang cá nhân vào danh sách phân hệ làm menu đọc không nhất quán.
 *
 * "Phòng ban" cũng không đứng cấp 1: nó là dữ liệu danh mục, nằm trong Cài đặt
 * cùng bốn màn danh mục còn lại. Để hai chỗ là cho một trang hai nhà.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'group-overview',
    labelKey: 'nav.groups.overview',
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, labelKey: 'nav.dashboard' },
      { key: '/reports', icon: <BarChartOutlined />, labelKey: 'nav.reports' },
    ],
  },
  {
    key: 'group-people',
    labelKey: 'nav.groups.people',
    items: [
      { key: '/employees', icon: <TeamOutlined />, labelKey: 'nav.employees' },
    ],
  },
  {
    key: 'group-time-pay',
    labelKey: 'nav.groups.timePay',
    items: [
      { key: '/attendance', icon: <ClockCircleOutlined />, labelKey: 'nav.attendance' },
      { key: '/leave', icon: <CalendarOutlined />, labelKey: 'nav.leave' },
      { key: '/payroll', icon: <DollarCircleOutlined />, labelKey: 'nav.payroll' },
    ],
  },
  {
    key: 'group-system',
    labelKey: 'nav.groups.system',
    items: [
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
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

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

  const isVisible = (item: NavItem): boolean => {
    if (item.key === '/settings') {
      return canWriteMasterData;
    }

    if (item.key === '/payroll') {
      return canReadPayroll;
    }

    return true;
  };

  /** Nhóm đã lọc quyền; nhóm rỗng bị bỏ luôn để không còn tiêu đề trống. */
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(isVisible),
  })).filter((group) => group.items.length > 0);

  const visibleItems = visibleGroups.flatMap((group) => group.items);

  // The Drawer always renders the full sidebar, even while the persisted
  // `sidebarCollapsed` flag is what opened it.
  const collapsed = sidebarCollapsed && !onNavigate;

  const toMenuItem = ({ key, icon, labelKey, children }: NavItem) => ({
    key,
    icon,
    label: t(labelKey),
    children: children
      ?.filter((child) => !child.adminOnly || canManageSettings)
      .map((child) => ({ key: child.key, label: t(child.labelKey) })),
  });

  /*
   * Thu gọn thì chỉ còn dãy icon, không còn chỗ cho tiêu đề nhóm — AntD vẫn vẽ
   * tiêu đề và nó tràn ra ngoài cột 80px. Nên ở trạng thái đó dùng đường kẻ
   * thay cho chữ: vẫn thấy được ranh giới giữa các nhóm.
   */
  const items: MenuProps['items'] = collapsed
    ? visibleGroups.flatMap((group, index) => [
        ...(index > 0 ? [{ type: 'divider' as const, key: `${group.key}-divider` }] : []),
        ...group.items.map(toMenuItem),
      ])
    : visibleGroups.map((group) => ({
        key: group.key,
        type: 'group' as const,
        label: t(group.labelKey),
        children: group.items.map(toMenuItem),
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
