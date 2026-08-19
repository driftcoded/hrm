import { useMemo } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCanReadAllAttendance } from '@/hooks/usePermissions';

/**
 * Vỏ của module Chấm công: tiêu đề + 3 tab, nội dung do route con render.
 *
 * TAB LÀ ROUTE THẬT, không phải state. `/attendance/overtime` mở được bằng
 * link, F5 vẫn ở đúng tab, và nút Back của trình duyệt chạy đúng — ba thứ mà
 * một `Tabs` giữ trạng thái trong bộ nhớ đều làm hỏng.
 *
 * TAB "Bảng chấm công" CHỈ HIỆN với vai trò xem được cả công ty. Nhân viên
 * thường bấm vào sẽ nhận 403 từ backend, nên hiện tab là mời họ bấm vào một
 * thứ chắc chắn hỏng.
 */
const TABS = [
  { key: '/attendance', labelKey: 'attendance.tabs.mine' },
  { key: '/attendance/overtime', labelKey: 'attendance.tabs.overtime' },
  { key: '/attendance/table', labelKey: 'attendance.tabs.table', allOnly: true },
] as const;

export function AttendanceLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const canReadAll = useCanReadAllAttendance();

  const items = useMemo(
    () =>
      TABS.filter((tab) => !('allOnly' in tab && tab.allOnly) || canReadAll).map(
        (tab) => ({ key: tab.key, label: t(tab.labelKey) }),
      ),
    [canReadAll, t],
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
