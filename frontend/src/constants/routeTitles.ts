/**
 * Single source of truth mapping a route path to its i18n title key.
 *
 * Three separate places need a human name for a route — the sidebar, the header
 * breadcrumb, and the open-tabs bar. Keeping one registry means renaming a
 * module touches one line instead of drifting out of sync across three.
 */
export const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'nav.dashboard',
  '/employees': 'nav.employees',
  '/departments': 'nav.departments',
  '/attendance': 'nav.attendance',
  '/payroll': 'nav.payroll',
  '/leave': 'nav.leave',
  '/reports': 'nav.reports',
  '/settings': 'nav.settings',
  '/profile': 'nav.profile',
};

/** The route the tab bar and breadcrumb treat as home; never closable. */
export const HOME_PATH = '/dashboard';

/**
 * Longest registered prefix for a pathname, so a detail route like
 * `/employees/42` still resolves to the `/employees` entry instead of falling
 * through to nothing.
 */
export function matchRoute(pathname: string): string | undefined {
  return Object.keys(ROUTE_TITLES)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/** i18n key for a pathname, or `undefined` when the route is not registered. */
export function routeTitleKey(pathname: string): string | undefined {
  const matched = matchRoute(pathname);
  return matched ? ROUTE_TITLES[matched] : undefined;
}
