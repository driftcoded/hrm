import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Vỏ của module Chấm công: tiêu đề + nội dung do route con render.
 *
 * KHÔNG CÒN TABBAR. Module từng có 2 tab (bảng công / đơn làm thêm giờ); luồng
 * đơn từ đã bị bỏ vì giờ làm thêm suy ra từ chính bảng công, nên chỉ còn một
 * màn hình. Một `Tabs` với đúng một tab không cho người dùng thêm thông tin gì
 * mà vẫn chiếm một hàng — bỏ đi. Vỏ này thì giữ: nó là nơi đặt tiêu đề chung, và
 * route lồng nhau vẫn cần một phần tử cha để `/attendance/table` redirect vào.
 *
 * KHÔNG CÓ TAB "của tôi". Hệ thống này không có chấm công cá nhân — nhân viên
 * thường không đăng nhập, và dữ liệu chấm công đến từ nền tảng ngoài. Ai vào
 * đây cũng là để xem hoặc nhập dữ liệu của người khác.
 */
export function AttendanceLayout() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('attendance.title')} subtitle={t('attendance.subtitle')} />

      <Outlet />
    </div>
  );
}
