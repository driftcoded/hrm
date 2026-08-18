import { App as AntdApp, ConfigProvider, type ThemeConfig } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClientProvider } from '@tanstack/react-query';
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
          <RouterConfig />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
