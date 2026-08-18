import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import 'antd/dist/reset.css';
// i18n must be initialized before the app renders any t() call.
import './i18n';
import './index.css';
import App from './App.tsx';

dayjs.locale('vi');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
