import { Layout } from 'antd';
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useGemLoginAutoStart } from '../../hooks';
import { useAppStore, useAuthStore } from '../../stores';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const { Content } = Layout;

const AppLayout: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const gemLogin = useGemLoginAutoStart();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const siderWidth = sidebarCollapsed ? 80 : 200;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Navbar gemLogin={gemLogin} />
        <Content
          style={{
            margin: 24,
            padding: 24,
            borderRadius: 12,
            minHeight: 360,
            background: 'rgba(0,0,0,0.01)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
