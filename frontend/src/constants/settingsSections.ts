/**
 * The five master-data screens under `/settings`.
 *
 * One registry feeds the sidebar submenu, the `/settings` index cards and the
 * route-title map, so adding a settings screen is a single edit instead of three
 * lists drifting apart.
 */
export interface SettingsSection {
  /** Last path segment — also the key for the icon map on the index page. */
  id: string;
  path: string;
  titleKey: string;
  descriptionKey: string;
}

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: 'departments',
    path: '/settings/departments',
    titleKey: 'nav.departments',
    descriptionKey: 'settings.index.departments',
  },
  {
    id: 'positions',
    path: '/settings/positions',
    titleKey: 'nav.positions',
    descriptionKey: 'settings.index.positions',
  },
  {
    id: 'contract-types',
    path: '/settings/contract-types',
    titleKey: 'nav.contractTypes',
    descriptionKey: 'settings.index.contractTypes',
  },
  {
    id: 'leave-types',
    path: '/settings/leave-types',
    titleKey: 'nav.leaveTypes',
    descriptionKey: 'settings.index.leaveTypes',
  },
  {
    id: 'holidays',
    path: '/settings/holidays',
    titleKey: 'nav.holidays',
    descriptionKey: 'settings.index.holidays',
  },
];
