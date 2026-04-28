import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { fetchUserById } from './adminApi';

function AdminUserInfoPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserById(id)
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-table-card">
          <div className="admin-loading">Yükleniyor...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="admin-table-card">
          <div className="admin-error">❌ Hata: {error}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <Link to="/admin/kullanicilar">Kullanıcılar</Link>
        <span className="sep">/</span>
        <span>{user.username}</span>
      </div>

      {/* Hero */}
      <div className="admin-detail-hero">
        <div className="admin-detail-avatar user-avatar">👤</div>
        <div className="admin-detail-title">
          <h1>{user.username}</h1>
          <p>{user.email} &middot; <span className={`role-badge ${user.is_admin ? 'admin' : 'user'}`}>{user.is_admin ? 'Admin' : 'Kullanıcı'}</span></p>
          <div className="admin-detail-actions">
            <Link to="/admin/kullanicilar" className="admin-btn back">← Geri Dön</Link>
          </div>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="admin-detail-grid">
        <div className="admin-detail-card">
          <h3>👤 Kişisel Bilgiler</h3>
          <div className="detail-row">
            <span className="detail-label">Kullanıcı ID</span>
            <span className="detail-value">#{user.id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Kullanıcı Adı</span>
            <span className="detail-value">{user.username}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">E-posta</span>
            <span className="detail-value">{user.email}</span>
          </div>
        </div>

        <div className="admin-detail-card">
          <h3>📊 Hesap Bilgileri</h3>
          <div className="detail-row">
            <span className="detail-label">Rol</span>
            <span className={`role-badge ${user.is_admin ? 'admin' : 'user'}`}>{user.is_admin ? 'Admin' : 'Kullanıcı'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Durum</span>
            <span className="detail-value">{user.is_admin ? '🛡️ Yönetici' : '👤 Standart Kullanıcı'}</span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminUserInfoPage;
