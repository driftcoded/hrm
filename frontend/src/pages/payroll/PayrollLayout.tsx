import { useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCanWritePayroll } from '@/hooks/usePermissions';

/**
 * Vỏ của phân hệ Lương: tiêu đề + tab, nội dung do route con render.
 *
 * TAB LÀ ROUTE THẬT, không phải state: `/payroll/advances` mở được bằng link,
 * F5 vẫn ở đúng tab, nút Back chạy đúng — ba thứ mà một `Tabs` giữ trạng thái
 * trong bộ nhớ đều làm hỏng.
 *
 * TAB "CẤU HÌNH" CHỈ HIỆN VỚI NGƯỜI SỬA ĐƯỢC. `hr_staff` đọc được bảng lương
 * nhưng backend từ chối cả GET lẫn PATCH `/payroll-settings`; bày ra một tab
 * chắc chắn trả về 403 là mời người dùng đi vào ngõ cụt.
 */
export function PayrollLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const canWrite = useCanWritePayroll();

  const items = useMemo(
    () =>
      [
        { key: '/payroll', label: t('payroll.tabs.salaries') },
        { key: '/payroll/advances', label: t('payroll.tabs.advances') },
        ...(canWrite
          ? [{ key: '/payroll/settings', label: t('payroll.tabs.settings') }]
          : []),
      ],
    [t, canWrite],
  );

  // Khớp dài nhất, để `/payroll/advances` không cùng lúc khớp `/payroll`.
  const activeKey =
    items
      .map((item) => item.key)
      .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '/payroll';

  return (
    <div>
      <PageHeader title={t('payroll.title')} subtitle={t('payroll.subtitle')} />

      <Tabs
        items={items}
        activeKey={activeKey}
        onChange={(key) => void navigate(key)}
      />

      <Outlet />
    </div>
  );
}
