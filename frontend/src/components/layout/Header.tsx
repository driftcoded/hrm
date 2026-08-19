import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Dropdown,
  Grid,
  Input,
  Layout,
  Tooltip,
  type MenuProps,
} from 'antd';
import {
  BellOutlined,
  DownOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { HOME_PATH, routeBreadcrumb } from '@/constants/routeTitles';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useUiStore, type Locale } from '@/store/uiStore';
import { getUserDisplayName, roleI18nKey } from '@/utils/user';
import styles from './Header.module.css';

const { Header: AntHeader } = Layout;

const LOCALES: Array<{ value: Locale; labelKey: string }> = [
  { value: 'vi', labelKey: 'locale.vi' },
  { value: 'en', labelKey: 'locale.en' },
];

/**
 * Content-column header: global search, notifications, help, language switcher
 * and the logged-in user's dropdown.
 *
 * Honesty rule applied throughout: controls whose backend does not exist yet
 * (search, notifications) are rendered `disabled` with a "Sắp có" tooltip
 * rather than looking live and doing nothing. Language switching is real.
 */
export function Header() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  /**
   * Breadcrumb lives in the header (not in each page's PageHeader) so it sits in
   * one fixed place regardless of which page is open. Home is always the first
   * crumb, then every registered ancestor of the current route — so a nested
   * screen reads "Trang chủ > Cài đặt > Phòng ban" (up to 3 levels, §3). Only the
   * last crumb is plain text; the ones above it navigate.
   */
  const crumbs = routeBreadcrumb(location.pathname).filter((crumb) => crumb.path !== HOME_PATH);
  const breadcrumbItems = [
    { title: <Link to={HOME_PATH}>{t('nav.dashboard')}</Link> },
    ...crumbs.map((crumb, index) => ({
      title:
        index === crumbs.length - 1 ? (
          t(crumb.titleKey)
        ) : (
          <Link to={crumb.path}>{t(crumb.titleKey)}</Link>
        ),
    })),
  ];

  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const themeMode = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const displayName = getUserDisplayName(user);
  const roleLabel = user?.role ? t(roleI18nKey(user.role), { defaultValue: user.role }) : '';

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('layout.viewProfile'),
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('layout.logout'),
      disabled: isLoggingOut,
      onClick: () => logout(),
    },
  ];

  const localeMenuItems: MenuProps['items'] = LOCALES.map(({ value, labelKey }) => ({
    key: value,
    label: t(labelKey),
    onClick: () => {
      setLocale(value);
      void i18n.changeLanguage(value);
    },
  }));

  const comingSoon = t('common.comingSoon');
  // The label names the DESTINATION, not the current state — "Switch to dark"
  // is unambiguous where "Dark mode" leaves a screen-reader user guessing
  // whether it reports the theme or sets it.
  const themeLabel = themeMode === 'dark' ? t('layout.themeToLight') : t('layout.themeToDark');

  return (
    <AntHeader className={styles.header}>
      <div className={styles.left}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={toggleSidebar}
            aria-label={t('layout.openNavigation')}
          />
        )}
        <Breadcrumb className={styles.breadcrumb} items={breadcrumbItems} />

        {/* Search has no backend yet (see docs/PLAN Giai đoạn 8 reports/search),
            so it is explicitly disabled instead of silently doing nothing. */}
        <Tooltip title={comingSoon}>
          <Input
            className={styles.search}
            disabled
            prefix={<SearchOutlined />}
            placeholder={t('layout.searchPlaceholder')}
            aria-label={t('common.comingSoonAria', { label: t('layout.search') })}
          />
        </Tooltip>
      </div>

      <div className={styles.right}>
        {/* A real control, unlike the two disabled placeholders below it, so it
            sits first in the cluster where it is reachable rather than buried
            behind them in the tab order. */}
        <Tooltip title={themeLabel}>
          <Button
            type="text"
            icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            aria-label={themeLabel}
            aria-pressed={themeMode === 'dark'}
          />
        </Tooltip>

        <Tooltip title={comingSoon}>
          {/* No notifications API until Giai đoạn 8: render the bell with no
              count rather than inventing an unread number. */}
          <Badge dot={false} count={0} showZero={false}>
            <Button
              type="text"
              disabled
              icon={<BellOutlined />}
              aria-label={t('common.comingSoonAria', { label: t('layout.notifications') })}
            />
          </Badge>
        </Tooltip>

        <Tooltip title={comingSoon}>
          <Button
            type="text"
            disabled
            icon={<QuestionCircleOutlined />}
            aria-label={t('common.comingSoonAria', { label: t('layout.help') })}
          />
        </Tooltip>

        <Dropdown menu={{ items: localeMenuItems, selectedKeys: [locale] }} trigger={['click']}>
          <button type="button" className={styles.localeButton} aria-label={t('layout.language')}>
            <span>{t(`locale.${locale}`)}</span>
            <DownOutlined className={styles.chevron} />
          </button>
        </Dropdown>

        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          {/* A real <button> so the menu is keyboard reachable (§11). */}
          <button type="button" className={styles.userButton} aria-label={t('layout.userMenu')}>
            <Avatar
              size={36}
              src={user?.employee?.avatarUrl ?? undefined}
              icon={<UserOutlined />}
              alt=""
            />
            <span className={styles.userText}>
              <span className={styles.userName}>{displayName || t('layout.profile')}</span>
              {roleLabel && <span className={styles.userRole}>{roleLabel}</span>}
            </span>
            <DownOutlined className={styles.chevron} />
          </button>
        </Dropdown>
      </div>
    </AntHeader>
  );
}
