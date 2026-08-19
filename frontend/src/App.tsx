import { App as AntdApp, ConfigProvider, type ThemeConfig } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClientProvider } from '@tanstack/react-query';
import { useApplyBranding } from '@/hooks/useApplyBranding';
import { queryClient } from '@/lib/queryClient';
import { RouterConfig } from '@/routes/RouterConfig';

// Design tokens — docs/ui-conventions.md §1-2. The same primitives are mirrored
// as CSS custom properties in src/styles/tokens.css for the CSS modules.
const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    fontSize: 14,
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
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme} locale={viVN}>
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
