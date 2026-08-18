import type { ReactNode } from 'react';
import { Breadcrumb, Typography, Space } from 'antd';
import { Link } from 'react-router';
import styles from './PageHeader.module.css';

const { Title } = Typography;

export interface PageBreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: PageBreadcrumbItem[];
  actions?: ReactNode;
}

/**
 * Reusable page header: breadcrumb (max 3 levels per
 * docs/ui-conventions.md §3) + title + right-aligned actions slot.
 */
export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          items={breadcrumbs.map((item) => ({
            title: item.path ? <Link to={item.path}>{item.label}</Link> : item.label,
          }))}
        />
      )}
      <div className={styles.titleRow}>
        <Title level={4} className={styles.title}>
          {title}
        </Title>
        {actions && <Space>{actions}</Space>}
      </div>
    </div>
  );
}
