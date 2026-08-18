import { Suspense } from 'react';
import { Drawer, Grid, Layout, Skeleton } from 'antd';
import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { NavTabs } from './NavTabs';
import { Sidebar } from './Sidebar';
import { useUiStore } from '@/store/uiStore';
import styles from './AppLayout.module.css';

const { Sider, Content } = Layout;

/**
 * Sidebar widths. These live here as numbers because AntD's `Sider` and
 * `Drawer` take numeric props — the matching CSS-module rules read the same
 * values from the `--hrm-sidebar-width*` tokens, so keep the two in sync.
 */
const SIDEBAR_WIDTH = 240;
const SIDEBAR_WIDTH_COLLAPSED = 80;

/**
 * Admin shell: a full-height Sidebar column on the left, with the Header and
 * Content stacked in their own column to the right — so the header spans only
 * the content area, not the sidebar (docs/ui-conventions.md §3).
 *
 * Responsive behaviour (§10):
 * - desktop / tablet: the Sider is visible; collapsing swaps 240px <-> 80px.
 * - mobile (< 768px): the Sider is dropped entirely and the same `<Sidebar/>`
 *   is served from a Drawer, because 80px of icons still eats a third of a
 *   phone screen.
 *
 * The Suspense boundary covers every lazy-loaded page rendered through
 * `Outlet`; a Skeleton fallback avoids the layout shift a page spinner would
 * cause (§7).
 */
export function AppLayout() {
  const { t } = useTranslation();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const screens = Grid.useBreakpoint();

  // `screens.md` is undefined on the very first render (before the media query
  // resolves), so treat only an explicit `false` as mobile to avoid flashing
  // the drawer layout on desktop.
  const isMobile = screens.md === false;

  // On mobile the collapse flag drives the Drawer instead of the Sider width.
  const drawerOpen = isMobile && !sidebarCollapsed;

  const page = (
    <Content className={styles.content}>
      <Suspense fallback={<Skeleton active title paragraph={{ rows: 6 }} />}>
        <Outlet />
      </Suspense>
    </Content>
  );

  return (
    <Layout className={styles.layout} hasSider={!isMobile}>
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          placement="left"
          width={SIDEBAR_WIDTH}
          onClose={() => setSidebarCollapsed(true)}
          closable={false}
          // Slot class rather than an inline style, so the dark background and
          // zero padding stay in the CSS module with the rest of the shell.
          classNames={{ body: styles.drawerBody }}
          aria-label={t('layout.navigation')}
        >
          <Sidebar onNavigate={() => setSidebarCollapsed(true)} />
        </Drawer>
      ) : (
        <Sider
          theme="dark"
          className={styles.sider}
          width={SIDEBAR_WIDTH}
          collapsedWidth={SIDEBAR_WIDTH_COLLAPSED}
          collapsed={sidebarCollapsed}
        >
          <Sidebar />
        </Sider>
      )}

      <Layout className={styles.main}>
        <Header />
        <NavTabs />
        {page}
      </Layout>
    </Layout>
  );
}
