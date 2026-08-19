import type { ReactNode } from 'react';
import { Card, Tooltip } from 'antd';
import {
  DollarOutlined,
  FileTextOutlined,
  RiseOutlined,
  ScheduleOutlined,
  SunOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { EmployeeSummary } from '@/types/employee.types';
import { formatCurrency } from '@/utils/format';
import styles from './EmployeeSideRail.module.css';

/**
 * Cột phải của màn chi tiết nhân viên: bốn ô chỉ số + các thẻ tóm tắt.
 *
 * VÌ SAO Ở ĐÂY MÀ KHÔNG PHẢI TRONG THẺ ĐẦU TRANG: bốn ô này trước nằm bên phải
 * thẻ đầu trang, chia nhau khoảng 22% chiều ngang, và nhãn bị cắt cụt thành
 * "Hiệu suất thá…", "Nghỉ phép c…". Ở cột 1/3 thì chúng đọc được.
 *
 * VÌ SAO NẰM NGOÀI TAB: đây là thông tin về CON NGƯỜI chứ không phải về tab
 * đang mở — lương cơ bản hay số ngày phép còn lại vẫn đúng khi đang xem tab
 * Hợp đồng. Đặt trong tab thì chúng biến mất mỗi lần đổi tab.
 *
 * BA TRONG BỐN Ô CHƯA CÓ DỮ LIỆU và hiển thị dấu gạch mờ kèm tooltip nêu giai
 * đoạn sẽ mang dữ liệu về, KHÔNG phải số bịa. Xem thêm hai thẻ cuối.
 */

interface KpiItem {
  icon: ReactNode;
  tone: 'green' | 'blue' | 'purple' | 'orange';
  label: string;
  value: string;
  /** Có giá trị = ô đang trống vì tính năng thuộc giai đoạn đó. */
  pendingPhase?: string;
}

export interface EmployeeSideRailProps {
  summary: EmployeeSummary | undefined;
}

export function EmployeeSideRail({ summary }: EmployeeSideRailProps) {
  const { t } = useTranslation();
  const contract = summary?.activeContract ?? null;

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
      // Chưa có hợp đồng là SỰ THẬT về hồ sơ, không phải tính năng còn thiếu,
      // nên dấu gạch ở đây không kèm nhãn giai đoạn.
      value: contract ? formatCurrency(contract.baseSalary) : '—',
    },
  ];

  const summaryRow = (icon: ReactNode, label: string, value: ReactNode) => (
    <div className={styles.summaryRow} key={label}>
      <span className={styles.summaryIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );

  return (
    <aside className={styles.rail}>
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

      <Card variant="borderless" title={t('employees.detail.sideContract')}>
        {contract ? (
          <>
            {summaryRow(
              <FileTextOutlined />,
              t('employees.fields.contractNumber'),
              contract.contractNumber,
            )}
            {summaryRow(
              <DollarOutlined />,
              t('employees.fields.baseSalary'),
              formatCurrency(contract.baseSalary),
            )}
            {summaryRow(
              <DollarOutlined />,
              t('employees.fields.positionAllowance'),
              formatCurrency(contract.positionAllowance),
            )}
            {summaryRow(
              <TeamOutlined />,
              t('employees.detail.dependentsCount'),
              summary?.activeDependents ?? 0,
            )}
          </>
        ) : (
          <p className={styles.pending}>{t('employees.hero.noContract')}</p>
        )}
      </Card>

      {/*
        Hai thẻ dưới cố ý CHƯA có số liệu. Chấm công thuộc Giai đoạn 4, bảng
        lương thuộc Giai đoạn 6 — in một con số bịa ở đây thì HR sẽ tin và dùng
        nó, nên chỗ này nói thẳng là chưa có.
      */}
      <Card variant="borderless" title={t('employees.detail.sideAttendance')}>
        <p className={styles.pending}>
          {t('employees.tabs.comingSoonDetail', { phase: '4' })}
        </p>
      </Card>

      <Card variant="borderless" title={t('employees.detail.sidePayroll')}>
        <p className={styles.pending}>
          {t('employees.tabs.comingSoonDetail', { phase: '6' })}
        </p>
      </Card>
    </aside>
  );
}
