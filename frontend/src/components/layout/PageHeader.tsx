import type { ReactNode } from 'react';
import { Typography, Space } from 'antd';
import styles from './PageHeader.module.css';

const { Title } = Typography;

interface PageHeaderProps {
  title: string;
  /** One-line description under the title (gray, smaller). */
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Reusable page header: title + optional subtitle + right-aligned actions slot.
 *
 * The breadcrumb deliberately lives in the app Header instead of here — it used
 * to be rendered per page, which meant every page had to remember to pass it and
 * the trail moved around depending on the page. One fixed location in the header
 * is both less code and less for the reader to track.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.titleRow}>
        <div className={styles.titleBlock}>
          <Title level={4} className={styles.title}>
            {title}
          </Title>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <Space wrap>{actions}</Space>}
      </div>
    </div>
  );
}
