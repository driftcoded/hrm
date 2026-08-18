import { Menu, type MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  DollarOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import styles from './Sidebar.module.css';

interface NavItem {
  key: string;
  icon: ReactNode;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, labelKey: 'nav.dashboard' },
  { key: '/employees', icon: <TeamOutlined />, labelKey: 'nav.employees' },
  { key: '/attendance', icon: <ClockCircleOutlined />, labelKey: 'nav.attendance' },
  { key: '/leave', icon: <CalendarOutlined />, labelKey: 'nav.leave' },
  { key: '/payroll', icon: <DollarOutlined />, labelKey: 'nav.payroll' },
  { key: '/settings', icon: <SettingOutlined />, labelKey: 'nav.settings' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const items: MenuProps['items'] = NAV_ITEMS.map(({ key, icon, labelKey }) => ({
    key,
    icon,
    label: t(labelKey),
  }));

  return (
    <Menu
      className={styles.menu}
      mode="inline"
      theme="dark"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => navigate(key)}
    />
  );
}
