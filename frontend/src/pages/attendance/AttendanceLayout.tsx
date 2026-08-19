import { useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Vỏ của module Chấm công: tiêu đề + 2 tab, nội dung do route con render.
 *
 * KHÔNG CÓ TAB "của tôi". Hệ thống này không có chấm công cá nhân — nhân viên
 * thường không đăng nhập, và dữ liệu chấm công đến từ nền tảng ngoài. Ai vào
 * đây cũng là để xem hoặc nhập dữ liệu của người khác.
 *
 * TAB LÀ ROUTE THẬT, không phải state. `/attendance/overtime` mở được bằng
 * link, F5 vẫn ở đúng tab, và nút Back của trình duyệt chạy đúng — ba thứ mà
 * một `Tabs` giữ trạng thái trong bộ nhớ đều làm hỏng.
 */
const TABS = [
  { key: '/attendance', labelKey: 'attendance.tabs.table' },
  { key: '/attendance/overtime', labelKey: 'attendance.tabs.overtime' },
] as const;

export function AttendanceLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = useMemo(
    () => TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) })),
    [t],
  );

  // Khớp dài nhất, để `/attendance/overtime` không cùng lúc khớp `/attendance`.
  const activeKey =
    items
      .map((item) => item.key)
      .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '/attendance';

  return (
    <div>
      <PageHeader title={t('attendance.title')} subtitle={t('attendance.subtitle')} />

      <Tabs
        items={items}
        activeKey={activeKey}
        onChange={(key) => void navigate(key)}
      />

      <Outlet />
    </div>
  );
}
