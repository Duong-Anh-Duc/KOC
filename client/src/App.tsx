import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AppLayout } from './components/layout';
import { useAppStore, useAuthStore } from './stores';

// Route-level code splitting: each page ships its own chunk so the initial
// bundle stays small and heavy deps (three.js, charts) load on demand.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const KOCManagementPage = lazy(() => import('./pages/KOCManagementPage'));
const RevenueControlPage = lazy(() => import('./pages/RevenueControlPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));
const SendRevenueEmailPage = lazy(() => import('./pages/SendRevenueEmailPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const YouTubeScraperPage = lazy(() => import('./pages/YouTubeScraperPage'));
const CronSettingsPage = lazy(() => import('./pages/CronSettingsPage'));
const EmailSettingsPage = lazy(() => import('./pages/EmailSettingsPage'));
const PermissionManagementPage = lazy(() => import('./pages/PermissionManagementPage'));
const MyRevenuePage = lazy(() => import('./pages/MyRevenuePage'));
const UniversePage = lazy(() => import('./pages/UniversePage'));

const RouteFallback: React.FC = () => (
  <div style={{ padding: 24, color: '#888', fontSize: 13 }}>Đang tải…</div>
);

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

/** Block KOC users from staff pages */
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
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/universe"
            element={
              <PrivateRoute>
                <UniversePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<IndexRedirect />} />
            {/* Staff pages (Admin + Manager with permission) */}
            <Route path="koc" element={<StaffRoute><KOCManagementPage /></StaffRoute>} />
            <Route path="revenue" element={<StaffRoute><RevenueControlPage /></StaffRoute>} />
            <Route path="stats" element={<StaffRoute><StatsPage /></StaffRoute>} />
            <Route path="send-revenue-email" element={<StaffRoute><SendRevenueEmailPage /></StaffRoute>} />
            <Route path="audit" element={<StaffRoute><AuditLogsPage /></StaffRoute>} />
            {/* Admin-only pages */}
            <Route path="users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
            <Route path="yt-scraper" element={<AdminRoute><YouTubeScraperPage /></AdminRoute>} />
            <Route path="cron-settings" element={<AdminRoute><CronSettingsPage /></AdminRoute>} />
            <Route path="email-settings" element={<AdminRoute><EmailSettingsPage /></AdminRoute>} />
            <Route path="permissions" element={<AdminRoute><PermissionManagementPage /></AdminRoute>} />
            {/* KOC portal */}
            <Route path="my-revenue" element={<KOCRoute><MyRevenuePage /></KOCRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
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
