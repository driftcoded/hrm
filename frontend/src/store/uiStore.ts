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
  setLocale: (locale: Locale) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      locale: 'vi',
      sidebarCollapsed: false,
      theme: 'light',
      setLocale: (locale) => set({ locale }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'hrm-ui-store' },
  ),
);
