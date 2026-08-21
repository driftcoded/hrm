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
  '/attendance': 'nav.attendance',
  '/payroll': 'nav.payroll',
  '/leave': 'nav.leave',
  '/reports': 'nav.reports',
  '/settings': 'nav.settings',
  '/settings/branding': 'nav.branding',
  '/settings/mail': 'nav.mailSettings',
  // Danh mục nghiệp vụ. Đăng ký từng màn để thanh tab và breadcrumb gọi đúng
  // tên nó, thay vì năm tab cùng đọc là "Danh mục".
  '/catalog': 'nav.catalog',
  '/catalog/departments': 'nav.departments',
  '/catalog/positions': 'nav.positions',
  '/catalog/contract-types': 'nav.contractTypes',
  '/catalog/leave-types': 'nav.leaveTypes',
  '/catalog/holidays': 'nav.holidays',
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

export interface RouteCrumb {
  path: string;
  titleKey: string;
}

/**
 * The registered ancestors of a pathname, outermost first — e.g.
 * `/catalog/departments` -> `[{/catalog}, {/catalog/departments}]`.
 *
 * This is what lets the header show "Trang chủ > Danh mục > Phòng ban" for a
 * nested route (up to 3 levels, docs/ui-conventions.md §3) while still reading
 * from this one registry rather than a second hand-written list.
 */
export function routeBreadcrumb(pathname: string): RouteCrumb[] {
  return Object.keys(ROUTE_TITLES)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => a.length - b.length)
    .map((path) => ({ path, titleKey: ROUTE_TITLES[path] }));
}
