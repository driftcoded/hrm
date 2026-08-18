import { ConfigProvider, type ThemeConfig } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { RouterConfig } from '@/routes/RouterConfig';

// Design tokens — docs/ui-conventions.md §1-2.
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
        <RouterConfig />
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
