import React from 'react';
import { Navigate } from 'react-router-dom';
import { getAdminSession } from './adminApi';

/**
 * Admin oturumu yoksa /admin/login sayfasına yönlendirir.
 */
function AdminProtectedRoute({ children }) {
  const session = getAdminSession();

  if (!session?.token || !session?.user?.is_admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default AdminProtectedRoute;
