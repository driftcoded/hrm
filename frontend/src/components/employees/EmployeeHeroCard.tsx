import type { ReactNode } from 'react';
import { Avatar } from 'antd';
import {
  CalendarOutlined,
  FileTextOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { EmployeeDetail, EmployeeSummary } from '@/types/employee.types';
import { formatDate, formatPhone } from '@/utils/format';
import { EmployeeStatusTag } from './EmployeeStatusTag';
import styles from './EmployeeHeroCard.module.css';

/**
 * Thẻ đầu màn chi tiết nhân viên: ảnh + danh tính + những thông tin tra cứu
 * nhiều nhất (ngày vào làm, loại hợp đồng, quản lý trực tiếp, email, SĐT).
 *
 * Lý do tồn tại: trước đây muốn biết "người này vào làm khi nào, ai quản lý"
 * thì phải cuộn qua cả form. Những thứ HR hỏi hàng ngày giờ nằm ngay trên đầu.
 *
 * Bốn ô chỉ số ĐÃ CHUYỂN sang `EmployeeSideRail`: ở đây chúng chỉ được ~22%
 * chiều ngang và nhãn bị cắt cụt ("Hiệu suất thá…"). Cột phải 1/3 đủ chỗ.
 */

interface MetaItem {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

export interface EmployeeHeroCardProps {
  employee: EmployeeDetail;
  summary: EmployeeSummary | undefined;
  /** Ảnh đại diện — trang cha truyền vào để giữ logic upload ở một chỗ. */
  avatarSlot: ReactNode;
}

export function EmployeeHeroCard({ employee, summary, avatarSlot }: EmployeeHeroCardProps) {
  const { t } = useTranslation();
  const contract = summary?.activeContract ?? null;

  const meta: MetaItem[] = [
    {
      icon: <CalendarOutlined />,
      label: t('employees.fields.hireDate'),
      value: formatDate(employee.hireDate),
    },
    {
      icon: <FileTextOutlined />,
      label: t('employees.fields.contractType'),
      value: contract ? (
        t(`employees.contractType.${contract.contractType}`)
      ) : (
        <span className={styles.muted}>{t('employees.hero.noContract')}</span>
      ),
    },
    {
      icon: <UserOutlined />,
      label: t('employees.fields.directManager'),
      value: employee.directManager ? (
        <span className={styles.manager}>
          <Avatar size={20} icon={<UserOutlined />} />
          {employee.directManager.name}
        </span>
      ) : (
        <span className={styles.muted}>—</span>
      ),
    },
    {
      icon: <MailOutlined />,
      label: t('employees.fields.email'),
      value: (
        <a href={`mailto:${employee.email}`} className={styles.link}>
          {employee.email}
        </a>
      ),
    },
    {
      icon: <PhoneOutlined />,
      label: t('employees.fields.phone'),
      value: <span className={styles.mono}>{formatPhone(employee.phone)}</span>,
    },
  ];

  return (
    <div className={styles.main}>
      <div className={styles.identity}>
        {avatarSlot}
        <div className={styles.identityText}>
          <div className={styles.nameRow}>
            <h2 className={styles.name}>{employee.fullName}</h2>
            <EmployeeStatusTag status={employee.status} />
          </div>
          <p className={styles.code}>{employee.employeeCode}</p>
          <p className={styles.position}>
            {employee.position?.name ?? <span className={styles.muted}>—</span>}
          </p>
          <p className={styles.department}>
            {employee.department?.name ?? <span className={styles.muted}>—</span>}
          </p>
        </div>
      </div>

      <dl className={styles.metaGrid}>
        {meta.map((item) => (
          <div key={item.label} className={styles.metaItem}>
            <span className={styles.metaIcon} aria-hidden="true">
              {item.icon}
            </span>
            <div className={styles.metaBody}>
              <dt className={styles.metaLabel}>{item.label}</dt>
              <dd className={styles.metaValue}>{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
