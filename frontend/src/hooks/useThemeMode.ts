import { useEffect } from 'react';
import { useUiStore, type ThemeMode } from '@/store/uiStore';

/** Kept in sync with the inline pre-paint script in index.html. */
const ATTRIBUTE = 'data-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The OS-level preference, or 'light' where the browser has no opinion. */
export function getSystemTheme(): ThemeMode {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Applies the persisted theme to the document.
 *
 * The attribute goes on `<html>` rather than a React-rendered wrapper because
 * the tokens in styles/tokens.css hang off `:root`, and because AntD renders
 * modals, dropdowns and message toasts into portals at `<body>` level — a
 * wrapper `<div>` inside `#root` would leave every one of those on the light
 * palette.
 *
 * `color-scheme` is set alongside it so the things CSS cannot reach follow too:
 * scrollbars, native form controls, the canvas behind an over-scroll bounce,
 * and the default background during the paint before React mounts.
 */
export function useThemeMode(): ThemeMode {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(ATTRIBUTE, theme);
    root.style.colorScheme = theme;
  }, [theme]);

  return theme;
}

/**
 * Follows the OS preference until the user picks a side themselves.
 *
 * `hasChosenTheme` is what separates "never touched it" from "deliberately
 * chose light while the OS is dark" — without it, an explicit light choice
 * would be silently overridden the moment the OS flipped to dark at sunset.
 */
export function useSystemThemeSync(): void {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (useUiStore.getState().hasChosenTheme) return;
      useUiStore.setState({ theme: event.matches ? 'dark' : 'light' });
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
}
