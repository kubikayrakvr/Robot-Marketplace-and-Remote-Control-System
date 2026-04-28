import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { fetchUsers } from './adminApi';

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers()
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const adminCount = users.filter(u => u.is_admin).length;

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
            <h3>{users.length}</h3>
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
          <div className="admin-stat-icon robots">👤</div>
          <div className="admin-stat-info">
            <h3>{users.length - adminCount}</h3>
            <p>Normal Kullanıcı</p>
          </div>
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="admin-table-card">
          <div className="admin-loading">Yükleniyor...</div>
        </div>
      )}

      {error && (
        <div className="admin-table-card">
          <div className="admin-error">❌ Hata: {error}</div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Kayıtlı Kullanıcılar</h2>
            <span className="count-badge">{users.length} kullanıcı</span>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Kullanıcı Adı</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>#{user.id}</td>
                  <td className="user-name">{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.is_admin ? 'admin' : 'user'}`}>
                      {user.is_admin ? 'Admin' : 'Kullanıcı'}
                    </span>
                  </td>
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
      )}
    </AdminLayout>
  );
}

export default AdminUsersPage;
