import { App as AntdApp, ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClientProvider } from '@tanstack/react-query';
import { useApplyBranding } from '@/hooks/useApplyBranding';
import { useSystemThemeSync, useThemeMode } from '@/hooks/useThemeMode';
import { queryClient } from '@/lib/queryClient';
import { RouterConfig } from '@/routes/RouterConfig';

// Design tokens — docs/ui-conventions.md §1-2. The same primitives are mirrored
// as CSS custom properties in src/styles/tokens.css for the CSS modules.
const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    fontSize: 14,
    // Raised from AntD's 0.45 default, which is 3.36:1 on white — below AA.
    // Mirrors --hrm-color-text-tertiary (§12).
    colorTextTertiary: 'rgba(0, 0, 0, 0.55)',
  },
};

/**
 * Dark theme (§12).
 *
 * `darkAlgorithm` derives the ~100 component tokens; the overrides below only
 * pin the handful that must agree with styles/tokens.css, because AntD paints
 * table rows, inputs and modals while the CSS modules paint the cards those
 * sit in. Left to its own defaults the algorithm would use a #000 layout and a
 * #141414 container — a flatter, colder ramp than the one the CSS uses, and the
 * seam between an AntD Table and its surrounding card would be visible.
 *
 * The surface values are the same four steps documented in tokens.css:
 * canvas -> container -> elevated, plus the border pair.
 */
const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    fontSize: 14,
    colorBgLayout: '#15181e',
    colorBgContainer: '#1e222a',
    colorBgElevated: '#262b34',
    colorBorder: '#4b5567',
    colorBorderSecondary: '#2a2f3a',
    colorText: 'rgba(255, 255, 255, 0.88)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.68)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.52)',
  },
};

/**
 * Renders nothing — applies branding (tab title/favicon) as a side effect.
 * Must live INSIDE `QueryClientProvider` (it calls `useBranding`), so it
 * cannot be a hook call directly in `App()`, which is what creates that
 * provider in the first place.
 */
function BrandingEffects() {
  useApplyBranding();
  return null;
}

function App() {
  // Stamps `data-theme` / `color-scheme` on <html> for the CSS tokens, and
  // keeps following the OS until the user picks a side in the header.
  const themeMode = useThemeMode();
  useSystemThemeSync();

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={themeMode === 'dark' ? darkTheme : lightTheme} locale={viVN}>
        {/*
          AntD's <App> provides the context-aware `message` / `notification` /
          `modal` instances used via `App.useApp()`, so they pick up the theme
          and locale above. `component={false}` renders no extra DOM wrapper.
        */}
        <AntdApp component={false}>
          <BrandingEffects />
          <RouterConfig />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
