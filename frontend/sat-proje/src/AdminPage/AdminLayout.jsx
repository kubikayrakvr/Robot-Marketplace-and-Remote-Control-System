import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminSession, getAdminSession } from './adminApi';
import './Admin.css';

function AdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getAdminSession();

  const isActive = (path) => location.pathname.startsWith(path);

  function handleLogout() {
    clearAdminSession();
    navigate('/admin/login');
  }

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
          <Link
            to="/admin/raporlar"
            className={`admin-nav-link ${isActive('/admin/raporlar') ? 'active' : ''}`}
          >
            <span className="nav-icon">📩</span>
            Raporlar
          </Link>

          <div className="admin-nav-spacer" />

          {/* Admin bilgisi */}
          {session?.user && (
            <div className="admin-nav-user">
              <span className="nav-icon">🛡️</span>
              <span className="admin-nav-username">{session.user.username}</span>
            </div>
          )}

          <button onClick={handleLogout} className="admin-nav-link logout" type="button">
            <span className="nav-icon">🚪</span>
            Çıkış Yap
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;
