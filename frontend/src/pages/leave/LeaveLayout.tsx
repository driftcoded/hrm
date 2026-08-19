import { useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Vỏ của module Nghỉ phép: tiêu đề + 3 tab, nội dung do route con render.
 *
 * KHÔNG CÓ TAB "của tôi". Nhân viên thường không đăng nhập hệ thống này; đây là
 * công cụ để quản lý ghi nhận đơn hộ và nhân sự duyệt.
 *
 * TAB LÀ ROUTE THẬT, không phải state: `/leave/balances` mở được bằng link, F5
 * vẫn ở đúng tab, nút Back chạy đúng — ba thứ mà một `Tabs` giữ trạng thái
 * trong bộ nhớ đều làm hỏng.
 */
const TABS = [
  { key: '/leave', labelKey: 'leave.tabs.requests' },
  { key: '/leave/balances', labelKey: 'leave.tabs.balances' },
  { key: '/leave/calendar', labelKey: 'leave.tabs.calendar' },
] as const;

export function LeaveLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = useMemo(
    () => TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) })),
    [t],
  );

  // Khớp dài nhất, để `/leave/balances` không cùng lúc khớp `/leave`.
  const activeKey =
    items
      .map((item) => item.key)
      .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '/leave';

  return (
    <div>
      <PageHeader title={t('leave.title')} subtitle={t('leave.subtitle')} />

      <Tabs items={items} activeKey={activeKey} onChange={(key) => void navigate(key)} />

      <Outlet />
    </div>
  );
}
