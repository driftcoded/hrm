import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/store/authStore';

/**
 * Layout route guard: redirects to /login when authStore.isAuthenticated
 * is false. See docs/architecture.md §5.2.
 */
export function PrivateRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
