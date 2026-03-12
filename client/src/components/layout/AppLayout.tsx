import { Grid, Layout } from 'antd';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AnimatedPage } from '../../components/common';
import { useGemLoginAutoStart } from '../../hooks';
import { useAppStore, useAuthStore } from '../../stores';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const { Content } = Layout;
const { useBreakpoint } = Grid;

const AppLayout: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const gemLogin = useGemLoginAutoStart();
  const screens = useBreakpoint();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // On mobile/tablet (< lg), sidebar overlays content → no margin
  const isMobile = !screens.lg;
  const siderWidth = isMobile ? 0 : (sidebarCollapsed ? 80 : 200);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Navbar gemLogin={gemLogin} />
        <Content
          style={{
            margin: isMobile ? 12 : 24,
            padding: isMobile ? 16 : 24,
            borderRadius: 12,
            minHeight: 360,
            background: 'rgba(0,0,0,0.01)',
          }}
        >
          <AnimatedPage><Outlet /></AnimatedPage>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
