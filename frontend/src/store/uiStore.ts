import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'vi' | 'en';
export type ThemeMode = 'light' | 'dark';

/**
 * UI preferences — persisted to localStorage since these are safe,
 * non-sensitive user preferences (unlike authStore). See
 * docs/architecture.md §4.2.
 */
interface UiState {
  locale: Locale;
  sidebarCollapsed: boolean;
  theme: ThemeMode;
  /**
   * Whether `theme` is a deliberate choice or just the OS preference we
   * defaulted to. Only a user choice pins the theme; until then the app keeps
   * following the OS (see `useSystemThemeSync`).
   */
  hasChosenTheme: boolean;
  setLocale: (locale: Locale) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

/**
 * Read before the store is created so a first-time visitor lands on the theme
 * their OS already asked for. `persist` merges the saved state over this, so a
 * returning user's own choice always wins.
 */
function initialTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      locale: 'vi',
      sidebarCollapsed: false,
      theme: initialTheme(),
      hasChosenTheme: false,
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme, hasChosenTheme: true }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
          hasChosenTheme: true,
        })),
    }),
    { name: 'hrm-ui-store' },
  ),
);
