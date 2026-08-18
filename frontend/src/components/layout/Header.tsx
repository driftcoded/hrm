import { Layout, Space, Dropdown, Avatar, Typography, type MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { logout } from '@/services/auth.service';
import styles from './Header.module.css';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const user = useAuthStore((state) => state.user);

  const handleLogout = () => {
    void logout().finally(() => navigate('/login', { replace: true }));
  };

  const menuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: t('layout.profile') },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: t('layout.logout'), onClick: handleLogout },
  ];

  const CollapseIcon = sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined;
  const collapseLabel = sidebarCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar');

  return (
    <AntHeader className={styles.header}>
      <div className={styles.left}>
        <CollapseIcon
          className={styles.trigger}
          onClick={toggleSidebar}
          role="button"
          aria-label={collapseLabel}
          title={collapseLabel}
        />
        <span className={styles.logo}>{t('app.name')}</span>
      </div>
      <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
        <Space className={styles.right}>
          <Avatar icon={<UserOutlined />} />
          <Text>{user?.fullName ?? t('layout.profile')}</Text>
        </Space>
      </Dropdown>
    </AntHeader>
  );
}
