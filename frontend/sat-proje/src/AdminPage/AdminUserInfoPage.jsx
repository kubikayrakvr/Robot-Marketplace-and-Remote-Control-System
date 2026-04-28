import React from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const fakeUserData = {
  '1': { name: 'Altan Turan', email: 'altan@example.com', role: 'Admin', robotsCount: 2, registeredAt: '2026-01-05', lastLogin: '2026-04-28 16:30', phone: '+90 555 123 4567', robots: ['Robot Alpha', 'Robot Delta'] },
  '2': { name: 'Veli Yılmaz', email: 'veli@example.com', role: 'Kullanıcı', robotsCount: 1, registeredAt: '2026-02-12', lastLogin: '2026-04-27 11:20', phone: '+90 555 987 6543', robots: ['Robot Beta'] },
  '3': { name: 'Ayşe Kaya', email: 'ayse@example.com', role: 'Kullanıcı', robotsCount: 1, registeredAt: '2026-03-18', lastLogin: '2026-04-26 09:45', phone: '+90 555 456 7890', robots: ['Robot Gamma'] },
  '4': { name: 'Mehmet Demir', email: 'mehmet@example.com', role: 'Kullanıcı', robotsCount: 1, registeredAt: '2026-04-01', lastLogin: '2026-04-28 08:10', phone: '+90 555 321 6540', robots: ['Robot Delta'] },
};

function AdminUserInfoPage() {
  const { id } = useParams();
  const user = fakeUserData[id] || fakeUserData['1'];

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <Link to="/admin/kullanicilar">Kullanıcılar</Link>
        <span className="sep">/</span>
        <span>{user.name}</span>
      </div>

      {/* Hero */}
      <div className="admin-detail-hero">
        <div className="admin-detail-avatar user-avatar">👤</div>
        <div className="admin-detail-title">
          <h1>{user.name}</h1>
          <p>{user.email} &middot; <span className={`role-badge ${user.role === 'Admin' ? 'admin' : 'user'}`}>{user.role}</span></p>
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
            <span className="detail-value">#{id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Ad Soyad</span>
            <span className="detail-value">{user.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">E-posta</span>
            <span className="detail-value">{user.email}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Telefon</span>
            <span className="detail-value">{user.phone}</span>
          </div>
        </div>

        <div className="admin-detail-card">
          <h3>📊 Hesap Bilgileri</h3>
          <div className="detail-row">
            <span className="detail-label">Rol</span>
            <span className={`role-badge ${user.role === 'Admin' ? 'admin' : 'user'}`}>{user.role}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Kayıt Tarihi</span>
            <span className="detail-value">{user.registeredAt}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Son Giriş</span>
            <span className="detail-value">{user.lastLogin}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Robot Sayısı</span>
            <span className="detail-value">{user.robotsCount}</span>
          </div>
        </div>

        <div className="admin-detail-card full-width">
          <h3>🤖 Sahip Olduğu Robotlar</h3>
          {user.robots.map((robotName, index) => (
            <div className="detail-row" key={index}>
              <span className="detail-label">Robot {index + 1}</span>
              <span className="detail-value">{robotName}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminUserInfoPage;
