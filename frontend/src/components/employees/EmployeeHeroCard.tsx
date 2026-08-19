import type { ReactNode } from 'react';
import { Avatar, Tooltip } from 'antd';
import {
  CalendarOutlined,
  DollarOutlined,
  FileTextOutlined,
  MailOutlined,
  PhoneOutlined,
  RiseOutlined,
  ScheduleOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { EmployeeDetail, EmployeeSummary } from '@/types/employee.types';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import { EmployeeStatusTag } from './EmployeeStatusTag';
import styles from './EmployeeHeroCard.module.css';

/**
 * Thẻ đầu màn chi tiết nhân viên: ảnh + danh tính, các thông tin tra cứu nhiều
 * nhất, và bốn ô chỉ số.
 *
 * Lý do tồn tại: trước đây muốn biết "người này vào làm khi nào, lương bao
 * nhiêu, ai quản lý" thì phải cuộn qua cả form. Những thứ HR hỏi hàng ngày giờ
 * nằm ngay trên đầu, không cần mở tab nào.
 *
 * BỐN Ô CHỈ SỐ — ba trong bốn ô chưa có dữ liệu, và chúng hiển thị "—" kèm tên
 * giai đoạn sẽ mang dữ liệu về, KHÔNG phải số bịa:
 *   - Hiệu suất       ← `performance_reviews` (Giai đoạn 7)
 *   - Ngày công tháng ← `attendances`         (Giai đoạn 4)
 *   - Nghỉ phép còn   ← `leave_balances`      (Giai đoạn 5)
 *   - Lương cơ bản    ← hợp đồng đang hiệu lực — CÓ THẬT
 * Giữ chỗ sẵn thay vì ẩn đi: đây đúng là bốn con số HR cần, và khi các giai
 * đoạn kia xong thì chỉ việc đổ dữ liệu vào chứ không phải dựng lại bố cục.
 */

interface MetaItem {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

interface KpiItem {
  icon: ReactNode;
  tone: 'green' | 'blue' | 'purple' | 'orange';
  label: string;
  value: string;
  /** Có giá trị = giải thích vì sao đang trống. */
  pendingPhase?: string;
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

  const kpis: KpiItem[] = [
    {
      icon: <RiseOutlined />,
      tone: 'green',
      label: t('employees.hero.performance'),
      value: '—',
      pendingPhase: '7',
    },
    {
      icon: <ScheduleOutlined />,
      tone: 'blue',
      label: t('employees.hero.workingDays'),
      value: '—',
      pendingPhase: '4',
    },
    {
      icon: <SunOutlined />,
      tone: 'purple',
      label: t('employees.hero.leaveLeft'),
      value: '—',
      pendingPhase: '5',
    },
    {
      icon: <DollarOutlined />,
      tone: 'orange',
      label: t('employees.fields.baseSalary'),
      // Không có hợp đồng hiệu lực là một SỰ THẬT về hồ sơ, không phải tính
      // năng còn thiếu — nên "—" ở đây không kèm nhãn giai đoạn.
      value: contract ? formatCurrency(contract.baseSalary) : '—',
    },
  ];

  return (
    <div className={styles.hero}>
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

      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.kpi}>
            <span className={`${styles.kpiIcon} ${styles[kpi.tone]}`} aria-hidden="true">
              {kpi.icon}
            </span>
            <div className={styles.kpiBody}>
              <span className={styles.kpiLabel}>{kpi.label}</span>
              {kpi.pendingPhase ? (
                <Tooltip title={t('employees.hero.pendingPhase', { phase: kpi.pendingPhase })}>
                  <span className={styles.kpiPending}>{kpi.value}</span>
                </Tooltip>
              ) : (
                <span className={styles.kpiValue}>{kpi.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
