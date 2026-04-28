import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Admin.css';

function AdminLayout({ children }) {
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <h2><span className="brand-icon">⚙️</span> ROBO BASE</h2>
          <p>Yönetim Paneli</p>
        </div>

        <nav className="admin-nav">
          <Link
            to="/admin/robots"
            className={`admin-nav-link ${isActive('/admin/robots') ? 'active' : ''}`}
          >
            <span className="nav-icon">🤖</span>
            Robotlar
          </Link>
          <Link
            to="/admin/kullanicilar"
            className={`admin-nav-link ${isActive('/admin/kullanicilar') || isActive('/admin/user') ? 'active' : ''}`}
          >
            <span className="nav-icon">👥</span>
            Kullanıcılar
          </Link>

          <div className="admin-nav-spacer" />

          <Link to="/login" className="admin-nav-link logout">
            <span className="nav-icon">🚪</span>
            Çıkış Yap
          </Link>
        </nav>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;
