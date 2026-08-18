import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { useSessionRestore } from '@/hooks/useAuth';

/**
 * Layout route guard (docs/architecture.md §5.2).
 *
 * The access token lives in memory only, so a page reload (F5) starts with an
 * empty `authStore`. Before deciding that the user is anonymous we attempt a
 * silent restore from the HttpOnly refresh cookie
 * (`POST /auth/refresh` -> `GET /auth/me`) and show a full-page loading state
 * while it resolves. Only once that attempt has actually failed do we redirect
 * to /login — preserving the attempted URL so login can send the user back.
 */
export function PrivateRoute() {
  const location = useLocation();
  const { isRestoring, isAuthenticated } = useSessionRestore();

  if (isRestoring) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`;
    return (
      <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} state={{ from }} replace />
    );
  }

  return <Outlet />;
}
