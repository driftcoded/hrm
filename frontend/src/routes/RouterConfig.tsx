import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { PrivateRoute } from './PrivateRoute';

/**
 * React Router v7, Data Router mode (createBrowserRouter + RouterProvider) —
 * this is a plain Vite SPA using the `react-router` library package
 * directly (not the `@react-router/dev` framework/SSR mode), so Data Router
 * is the current recommended API, same shape as v6.4+.
 */
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
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
