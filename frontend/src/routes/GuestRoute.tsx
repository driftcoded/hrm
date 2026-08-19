import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { useSessionRestore } from '@/hooks/useAuth';
import { SESSION_EXPIRED_PARAM } from '@/lib/axios';
import { sanitizeRedirectPath } from '@/utils/validators';

/**
 * Guard for the login screen: someone who still has a usable session should be
 * let straight in, not asked to type their password again.
 *
 * Why this is needed. The access token lives in memory only, so after a reload,
 * a new tab, or reopening the browser the store starts empty — even though the
 * HttpOnly refresh cookie is still perfectly valid for up to seven days.
 * `PrivateRoute` already recovers from that, but it only runs on protected
 * routes; landing directly on `/login` (a bookmark, a reopened tab) used to show
 * the form and demand credentials that the browser could have supplied itself
 * with one `POST /auth/refresh`.
 *
 * So the same silent restore runs here, and a success redirects to wherever the
 * user was heading. A failure simply shows the login form.
 *
 * Deliberately NOT applied to `/forgot-password` or `/reset-password`: a signed-in
 * user following a reset link from their inbox must still be able to use it.
 *
 * No redirect loop is possible: both guards read the same resolved state after
 * the single restore attempt (`authStore.sessionChecked` makes it run once per
 * page lifetime), so exactly one of them can want to redirect.
 */
export function GuestRoute() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Arriving here because a refresh just failed means the session is already
  // known to be unusable. Retrying it would either fail again for nothing, or —
  // worse — succeed and throw the user back at the page that just rejected them.
  const afterFailedRefresh = searchParams.get(SESSION_EXPIRED_PARAM) === '1';
  const { isRestoring, isAuthenticated } = useSessionRestore(!afterFailedRefresh);

  if (isRestoring) {
    return <FullPageLoader />;
  }

  if (isAuthenticated) {
    // Honour the return path the protected route asked for. Sanitised because it
    // comes from the query string; the helper falls back to /dashboard itself and
    // rejects anything that could be an open redirect.
    const requested =
      searchParams.get('redirect') ?? (location.state as { from?: string } | null)?.from;

    return <Navigate to={sanitizeRedirectPath(requested)} replace />;
  }

  return <Outlet />;
}
