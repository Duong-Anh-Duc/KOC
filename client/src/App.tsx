import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppLayout } from './components/layout';
import {
  AuditLogsPage,
  CronSettingsPage,
  DashboardPage,
  EmailSettingsPage,
  KOCManagementPage,
  LoginPage,
  MyRevenuePage,
  RevenueControlPage,
  SendRevenueEmailPage,
  StatsPage,
  YouTubeScraperPage,
} from './pages';
import { useAppStore, useAuthStore } from './stores';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Block KOC users from staff-only pages */
const StaffRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'KOC') return <Navigate to="/my-revenue" replace />;
  return <>{children}</>;
};

/** Only KOC users */
const KOCRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'KOC') return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Smart index redirect: KOC → /my-revenue, others → Dashboard */
const IndexRedirect: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'KOC') return <Navigate to="/my-revenue" replace />;
  return <DashboardPage />;
};

const App: React.FC = () => {
  const darkMode = useAppStore((s) => s.darkMode);
  
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<IndexRedirect />} />
            {/* Staff-only pages */}
            <Route path="koc" element={<StaffRoute><KOCManagementPage /></StaffRoute>} />
            <Route path="revenue" element={<StaffRoute><RevenueControlPage /></StaffRoute>} />
            <Route path="stats" element={<StaffRoute><StatsPage /></StaffRoute>} />
            <Route path="yt-scraper" element={<StaffRoute><YouTubeScraperPage /></StaffRoute>} />
            {/* Admin-only pages */}
            <Route
              path="cron-settings"
              element={
                <AdminRoute>
                  <CronSettingsPage />
                </AdminRoute>
              }
            />
            <Route
              path="email-settings"
              element={
                <AdminRoute>
                  <EmailSettingsPage />
                </AdminRoute>
              }
            />
            <Route
              path="send-revenue-email"
              element={
                <AdminRoute>
                  <SendRevenueEmailPage />
                </AdminRoute>
              }
            />
            <Route
              path="audit"
              element={
                <AdminRoute>
                  <AuditLogsPage />
                </AdminRoute>
              }
            />
            {/* KOC portal */}
            <Route path="my-revenue" element={<KOCRoute><MyRevenuePage /></KOCRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={darkMode ? 'dark' : 'light'}
      />
    </>
  );
};

export default App;
