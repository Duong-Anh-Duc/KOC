import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import axios from 'axios';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';
import './locales/i18n';
import { useAppStore, useAuthStore } from './stores';

// On startup: try to refresh access token silently using HttpOnly cookie
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
try {
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
  const { token, user } = res.data.data;
  useAuthStore.getState().setAuth(user, token);
} catch {
  // No valid refresh token — user needs to login
  useAuthStore.getState().logout();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const Root: React.FC = () => {
  const locale = useAppStore((s) => s.locale);
  const darkMode = useAppStore((s) => s.darkMode);
  const antLocale = locale === 'vi' ? viVN : enUS;

  // Sync data-theme attribute for CSS dark mode selectors
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          locale={antLocale}
          theme={{
            algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
            token: {
              colorPrimary: '#ED8F3A',
              borderRadius: 6,
            },
          }}
        >
          <AntApp>
            <App />
          </AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
