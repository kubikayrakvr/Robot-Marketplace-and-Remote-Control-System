import React from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const fakeRobots = [
  { id: 1, name: 'Robot Alpha', model: 'RA-100', status: 'Aktif', owner: 'Altan Turan', registeredAt: '2026-01-15' },
  { id: 2, name: 'Robot Beta', model: 'RB-200', status: 'Beklemede', owner: 'Veli Yılmaz', registeredAt: '2026-02-20' },
  { id: 3, name: 'Robot Gamma', model: 'RG-300', status: 'Pasif', owner: 'Ayşe Kaya', registeredAt: '2026-03-10' },
  { id: 4, name: 'Robot Delta', model: 'RD-400', status: 'Aktif', owner: 'Mehmet Demir', registeredAt: '2026-04-05' },
];

function getStatusClass(status) {
  if (status === 'Aktif') return 'aktif';
  if (status === 'Beklemede') return 'beklemede';
  return 'pasif';
}

function AdminRobotsPage() {
  const activeCount = fakeRobots.filter(r => r.status === 'Aktif').length;
  const pendingCount = fakeRobots.filter(r => r.status === 'Beklemede').length;

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <span>Admin</span>
        <span className="sep">/</span>
        <span>Robotlar</span>
      </div>
      <div className="admin-topbar">
        <h1>Robot Yönetimi</h1>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon robots">🤖</div>
          <div className="admin-stat-info">
            <h3>{fakeRobots.length}</h3>
            <p>Toplam Robot</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon active">✅</div>
          <div className="admin-stat-info">
            <h3>{activeCount}</h3>
            <p>Aktif Robot</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon users">⏳</div>
          <div className="admin-stat-info">
            <h3>{pendingCount}</h3>
            <p>Onay Bekleyen</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-card">
        <div className="admin-table-header">
          <h2>Kayıtlı Robotlar</h2>
          <span className="count-badge">{fakeRobots.length} robot</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Robot</th>
              <th>Model</th>
              <th>Durum</th>
              <th>Sahip</th>
              <th>Kayıt Tarihi</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {fakeRobots.map(robot => (
              <tr key={robot.id}>
                <td>#{robot.id}</td>
                <td className="robot-name">{robot.name}</td>
                <td>{robot.model}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(robot.status)}`}>
                    {robot.status}
                  </span>
                </td>
                <td>{robot.owner}</td>
                <td>{robot.registeredAt}</td>
                <td>
                  <div className="admin-actions">
                    <Link to={`/admin/robots/bilgi/${robot.id}`} className="admin-btn info">
                      👁 Bilgi
                    </Link>
                    <Link to={`/admin/robots/duzenle/${robot.id}`} className="admin-btn edit">
                      ✏️ Düzenle
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

export default AdminRobotsPage;
