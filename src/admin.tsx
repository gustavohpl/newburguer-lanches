import React, { useState } from 'react';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ConfigProvider } from './ConfigContext';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <ConfigProvider>
      <div className="min-h-screen bg-gray-100">
        {!isAuthenticated ? (
          <AdminLogin onLogin={() => setIsAuthenticated(true)} />
        ) : (
          <AdminDashboard onLogout={() => setIsAuthenticated(false)} />
        )}
      </div>
    </ConfigProvider>
  );
}
