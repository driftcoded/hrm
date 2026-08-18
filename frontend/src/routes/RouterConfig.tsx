import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageLoader } from '@/components/common/FullPageLoader';
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

/**
 * Modules the sidebar links to whose feature ships in a later phase. They get
 * real routes with an explicit "coming soon" page so navigation never lands on
 * a dead link or a redirect that looks like a bug.
 *
 * `departments` left this list in Giai đoạn 2.2: departments are master data and
 * now live at `/settings/departments`. The old top-level path is kept below as a
 * redirect so links and bookmarks to it still work.
 */
const UPCOMING_MODULES: Array<{ path: string; titleKey: string; phase: string }> = [
  { path: 'employees', titleKey: 'nav.employees', phase: '3' },
  { path: 'attendance', titleKey: 'nav.attendance', phase: '4' },
  { path: 'payroll', titleKey: 'nav.payroll', phase: '6' },
  { path: 'leave', titleKey: 'nav.leave', phase: '5' },
  { path: 'reports', titleKey: 'nav.reports', phase: '8' },
];

function fullPage(node: ReactNode) {
  return <Suspense fallback={<FullPageLoader />}>{node}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: fullPage(<LoginPage />),
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
            path: 'settings',
            children: [
              { index: true, element: <SettingsIndexPage /> },
              { path: 'departments', element: <DepartmentsPage /> },
              { path: 'positions', element: <PositionsPage /> },
              { path: 'contract-types', element: <ContractTypesPage /> },
              { path: 'leave-types', element: <LeaveTypesPage /> },
              { path: 'holidays', element: <HolidaysPage /> },
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
