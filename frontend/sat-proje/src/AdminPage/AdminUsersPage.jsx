import React from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const fakeUsers = [
  { id: 1, name: 'Altan Turan', email: 'altan@example.com', role: 'Admin', robotsCount: 2, registeredAt: '2026-01-05' },
  { id: 2, name: 'Veli Yılmaz', email: 'veli@example.com', role: 'Kullanıcı', robotsCount: 1, registeredAt: '2026-02-12' },
  { id: 3, name: 'Ayşe Kaya', email: 'ayse@example.com', role: 'Kullanıcı', robotsCount: 1, registeredAt: '2026-03-18' },
  { id: 4, name: 'Mehmet Demir', email: 'mehmet@example.com', role: 'Kullanıcı', robotsCount: 1, registeredAt: '2026-04-01' },
];

function AdminUsersPage() {
  const adminCount = fakeUsers.filter(u => u.role === 'Admin').length;
  const totalRobots = fakeUsers.reduce((sum, u) => sum + u.robotsCount, 0);

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <span>Admin</span>
        <span className="sep">/</span>
        <span>Kullanıcılar</span>
      </div>
      <div className="admin-topbar">
        <h1>Kullanıcı Yönetimi</h1>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon users">👥</div>
          <div className="admin-stat-info">
            <h3>{fakeUsers.length}</h3>
            <p>Toplam Kullanıcı</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon active">🛡️</div>
          <div className="admin-stat-info">
            <h3>{adminCount}</h3>
            <p>Admin</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon robots">🤖</div>
          <div className="admin-stat-info">
            <h3>{totalRobots}</h3>
            <p>Toplam Sahip Robot</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-card">
        <div className="admin-table-header">
          <h2>Kayıtlı Kullanıcılar</h2>
          <span className="count-badge">{fakeUsers.length} kullanıcı</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Rol</th>
              <th>Robot Sayısı</th>
              <th>Kayıt Tarihi</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {fakeUsers.map(user => (
              <tr key={user.id}>
                <td>#{user.id}</td>
                <td className="user-name">{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge ${user.role === 'Admin' ? 'admin' : 'user'}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.robotsCount}</td>
                <td>{user.registeredAt}</td>
                <td>
                  <div className="admin-actions">
                    <Link to={`/admin/user/bilgi/${user.id}`} className="admin-btn info">
                      👁 Bilgi
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

export default AdminUsersPage;
