import { create } from 'zustand';
import { HOME_PATH, matchRoute } from '@/constants/routeTitles';

export interface OpenTab {
  /** The route path — also the tab's identity. */
  path: string;
  /** i18n key for the label; resolved at render time so tabs follow the locale. */
  titleKey: string;
}

interface TabsState {
  tabs: OpenTab[];
  /** Register a visited route, or no-op if it is already open. */
  openTab: (tab: OpenTab) => void;
  /**
   * Close one tab and report where to navigate next: the neighbour on the left,
   * or `null` when the closed tab was not the active one (stay put).
   */
  closeTab: (path: string, activePath: string) => string | null;
  /** Close everything except `keepPath` (and home, which is never closable). */
  closeOthers: (keepPath: string) => void;
  /** Close everything but home. */
  closeAll: () => void;
}

/**
 * Open-tabs bar state.
 *
 * Deliberately NOT persisted: tabs describe "what I'm doing right now", and a
 * restored set of stale tabs after a day away is noise rather than help. It also
 * keeps this store free of the migration burden a persisted schema carries.
 */
export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],

  openTab: ({ path, titleKey }) => {
    // Normalize to the registered route so `/employees/42` reuses the
    // `/employees` tab instead of spawning one tab per record.
    const normalized = matchRoute(path) ?? path;
    if (get().tabs.some((tab) => tab.path === normalized)) {
      return;
    }
    set((state) => ({ tabs: [...state.tabs, { path: normalized, titleKey }] }));
  },

  closeTab: (path, activePath) => {
    if (path === HOME_PATH) {
      return null; // home stays open
    }
    const { tabs } = get();
    const index = tabs.findIndex((tab) => tab.path === path);
    if (index === -1) {
      return null;
    }
    const remaining = tabs.filter((tab) => tab.path !== path);
    set({ tabs: remaining });

    if (path !== activePath) {
      return null;
    }
    // Prefer the tab to the left, then whatever is left, then home.
    return remaining[index - 1]?.path ?? remaining[0]?.path ?? HOME_PATH;
  },

  closeOthers: (keepPath) =>
    set((state) => ({
      tabs: state.tabs.filter((tab) => tab.path === keepPath || tab.path === HOME_PATH),
    })),

  closeAll: () => set((state) => ({ tabs: state.tabs.filter((tab) => tab.path === HOME_PATH) })),
}));
