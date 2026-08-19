import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { GuestRoute } from './GuestRoute';
import { PrivateRoute } from './PrivateRoute';

/**
 * React Router v7, Data Router mode (createBrowserRouter + RouterProvider) —
 * this is a plain Vite SPA using the `react-router` library package
 * directly (not the `@react-router/dev` framework/SSR mode), so Data Router
 * is the current recommended API, same shape as v6.4+.
 *
 * Every page-level component is code-split with `React.lazy`
 * (docs/architecture.md §9). Pages rendered inside `AppLayout` are covered by
 * the Suspense boundary in that layout; the standalone auth screens get their
 * own full-page fallback here.
 */
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const ComingSoonPage = lazy(() =>
  import('@/pages/ComingSoonPage').then((module) => ({ default: module.ComingSoonPage })),
);

// Employees module (Giai đoạn 3.2), each its own chunk.
const EmployeesPage = lazy(() =>
  import('@/pages/employees/EmployeesPage').then((module) => ({ default: module.EmployeesPage })),
);
const EmployeeDetailPage = lazy(() =>
  import('@/pages/employees/EmployeeDetailPage').then((module) => ({
    default: module.EmployeeDetailPage,
  })),
);

// Attendance module (Giai đoạn 4.2), each its own chunk.
const AttendanceLayout = lazy(() =>
  import('@/pages/attendance/AttendanceLayout').then((module) => ({
    default: module.AttendanceLayout,
  })),
);
const AttendanceTablePage = lazy(() =>
  import('@/pages/attendance/AttendanceTablePage').then((module) => ({
    default: module.AttendanceTablePage,
  })),
);

// Leave module (Giai đoạn 5.2), each its own chunk.
const LeaveLayout = lazy(() =>
  import('@/pages/leave/LeaveLayout').then((module) => ({ default: module.LeaveLayout })),
);
const LeaveRequestsPage = lazy(() =>
  import('@/pages/leave/LeaveRequestsPage').then((module) => ({
    default: module.LeaveRequestsPage,
  })),
);
const LeaveBalancesPage = lazy(() =>
  import('@/pages/leave/LeaveBalancesPage').then((module) => ({
    default: module.LeaveBalancesPage,
  })),
);
const LeaveCalendarPage = lazy(() =>
  import('@/pages/leave/LeaveCalendarPage').then((module) => ({
    default: module.LeaveCalendarPage,
  })),
);
const PayrollLayout = lazy(() =>
  import('@/pages/payroll/PayrollLayout').then((module) => ({
    default: module.PayrollLayout,
  })),
);
const PayrollPage = lazy(() =>
  import('@/pages/payroll/PayrollPage').then((module) => ({
    default: module.PayrollPage,
  })),
);
const SalaryAdvancesPage = lazy(() =>
  import('@/pages/payroll/SalaryAdvancesPage').then((module) => ({
    default: module.SalaryAdvancesPage,
  })),
);
const PayrollSettingsPage = lazy(() =>
  import('@/pages/payroll/PayrollSettingsPage').then((module) => ({
    default: module.PayrollSettingsPage,
  })),
);

// Master-data settings screens (Giai đoạn 2.2), each its own chunk.
const SettingsIndexPage = lazy(() =>
  import('@/pages/settings/SettingsIndexPage').then((module) => ({
    default: module.SettingsIndexPage,
  })),
);
const DepartmentsPage = lazy(() =>
  import('@/pages/settings/DepartmentsPage').then((module) => ({
    default: module.DepartmentsPage,
  })),
);
const PositionsPage = lazy(() =>
  import('@/pages/settings/PositionsPage').then((module) => ({ default: module.PositionsPage })),
);
const ContractTypesPage = lazy(() =>
  import('@/pages/settings/ContractTypesPage').then((module) => ({
    default: module.ContractTypesPage,
  })),
);
const LeaveTypesPage = lazy(() =>
  import('@/pages/settings/LeaveTypesPage').then((module) => ({ default: module.LeaveTypesPage })),
);
const HolidaysPage = lazy(() =>
  import('@/pages/settings/HolidaysPage').then((module) => ({ default: module.HolidaysPage })),
);
const BrandingSettingsPage = lazy(() =>
  import('@/pages/settings/BrandingSettingsPage').then((module) => ({
    default: module.BrandingSettingsPage,
  })),
);
const MailSettingsPage = lazy(() =>
  import('@/pages/settings/MailSettingsPage').then((module) => ({
    default: module.MailSettingsPage,
  })),
);

/**
 * Modules the sidebar links to whose feature ships in a later phase. They get
 * real routes with an explicit "coming soon" page so navigation never lands on
 * a dead link or a redirect that looks like a bug.
 *
 * `departments` left this list in Giai đoạn 2.2: departments are master data and
 * now live at `/settings/departments`. `employees` left it in Giai đoạn 3.2,
 * `attendance` in Giai đoạn 4.2, `leave` in 5.2 and `payroll` in 6.2 — all four
 * modules have real screens now.
 */
const UPCOMING_MODULES: Array<{ path: string; titleKey: string; phase: string }> = [
  { path: 'reports', titleKey: 'nav.reports', phase: '8' },
];

function fullPage(node: ReactNode) {
  return <Suspense fallback={<FullPageLoader />}>{node}</Suspense>;
}

const router = createBrowserRouter([
  {
    // GuestRoute lets a visitor with a still-valid refresh cookie straight
    // through instead of asking for a password again. Only /login is wrapped:
    // a signed-in user following a password-reset link from their inbox must
    // still reach that screen.
    element: <GuestRoute />,
    children: [{ path: '/login', element: fullPage(<LoginPage />) }],
  },
  {
    path: '/forgot-password',
    element: fullPage(<ForgotPasswordPage />),
  },
  {
    path: '/reset-password',
    element: fullPage(<ResetPasswordPage />),
  },
  {
    path: '/',
    element: <PrivateRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            path: 'employees',
            children: [
              { index: true, element: <EmployeesPage /> },
              { path: ':id', element: <EmployeeDetailPage /> },
            ],
          },
          {
            path: 'attendance',
            element: <AttendanceLayout />,
            children: [
              /*
                 Bảng chấm công là màn hình MẶC ĐỊNH của module: hệ thống này
                 không có chấm công cá nhân, ai vào cũng là để xem/nhập dữ liệu
                 của người khác.

                 `/attendance/table` và `/attendance/overtime` giữ lại như hai
                 redirect: cả hai từng là địa chỉ thật trong bản trước, và
                 bookmark thì không tự sửa. `overtime` về đây vì giờ làm thêm nay
                 là MỘT CỘT của bảng này chứ không còn màn hình riêng — để nó rơi
                 vào route bắt-tất `*` thì người dùng bị đẩy về dashboard, xa chỗ
                 chứa đúng dữ liệu họ đang tìm.
              */
              { index: true, element: <AttendanceTablePage /> },
              { path: 'table', element: <Navigate to="/attendance" replace /> },
              { path: 'overtime', element: <Navigate to="/attendance" replace /> },
            ],
          },
          {
            path: 'leave',
            element: <LeaveLayout />,
            children: [
              { index: true, element: <LeaveRequestsPage /> },
              { path: 'balances', element: <LeaveBalancesPage /> },
              { path: 'calendar', element: <LeaveCalendarPage /> },
            ],
          },
          {
            path: 'payroll',
            element: <PayrollLayout />,
            children: [
              { index: true, element: <PayrollPage /> },
              { path: 'advances', element: <SalaryAdvancesPage /> },
              /*
               * Cấu hình lương nằm dưới `/payroll` chứ không dưới `/settings`:
               * nó chỉ có nghĩa với người đang làm bảng lương, và `/settings` là
               * nơi của master data dùng chung cho mọi phân hệ.
               */
              { path: 'settings', element: <PayrollSettingsPage /> },
            ],
          },
          {
            path: 'settings',
            children: [
              { index: true, element: <SettingsIndexPage /> },
              { path: 'departments', element: <DepartmentsPage /> },
              { path: 'positions', element: <PositionsPage /> },
              { path: 'contract-types', element: <ContractTypesPage /> },
              { path: 'leave-types', element: <LeaveTypesPage /> },
              { path: 'holidays', element: <HolidaysPage /> },
              { path: 'branding', element: <BrandingSettingsPage /> },
              { path: 'mail', element: <MailSettingsPage /> },
            ],
          },
          // Departments moved under /settings in Giai đoạn 2.2 — keep the old
          // path working instead of 404-ing bookmarks and open tabs.
          { path: 'departments', element: <Navigate to="/settings/departments" replace /> },
          ...UPCOMING_MODULES.map(({ path, titleKey, phase }) => ({
            path,
            element: <ComingSoonPage titleKey={titleKey} phase={phase} />,
          })),
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function RouterConfig() {
  return <RouterProvider router={router} />;
}
