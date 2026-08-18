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

/**
 * Modules the sidebar links to whose feature ships in a later phase. They get
 * real routes with an explicit "coming soon" page so navigation never lands on
 * a dead link or a redirect that looks like a bug.
 */
const UPCOMING_MODULES: Array<{ path: string; titleKey: string; phase: string }> = [
  { path: 'employees', titleKey: 'nav.employees', phase: '3' },
  { path: 'departments', titleKey: 'nav.departments', phase: '2' },
  { path: 'attendance', titleKey: 'nav.attendance', phase: '4' },
  { path: 'payroll', titleKey: 'nav.payroll', phase: '6' },
  { path: 'leave', titleKey: 'nav.leave', phase: '5' },
  { path: 'reports', titleKey: 'nav.reports', phase: '8' },
  { path: 'settings', titleKey: 'nav.settings', phase: '2' },
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
