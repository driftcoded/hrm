import { Layout } from 'antd';
import { Outlet } from 'react-router';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useUiStore } from '@/store/uiStore';
import styles from './AppLayout.module.css';

const { Sider, Content } = Layout;

/**
 * Header (64px) + collapsible Sidebar (240px / 80px) + Content, per
 * docs/ui-conventions.md §3.
 */
export function AppLayout() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <Layout className={styles.layout}>
      <Header />
      <Layout>
        <Sider width={240} collapsedWidth={80} collapsed={sidebarCollapsed} theme="dark">
          <Sidebar />
        </Sider>
        <Layout className={styles.contentWrapper}>
          <Content className={styles.content}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
