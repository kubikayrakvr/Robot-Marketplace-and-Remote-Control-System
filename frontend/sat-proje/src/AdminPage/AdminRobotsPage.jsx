import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { fetchRobots, deleteRobot } from './adminApi';

function AdminRobotsPage() {
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRobots = () => {
    setLoading(true);
    fetchRobots()
      .then((data) => {
        setRobots(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRobots();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`${name} modelini ve tüm envanterini silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteRobot(id);
      loadRobots();
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  const availableCount = robots.filter(r => r.is_available).length;
  const outOfStockCount = robots.filter(r => r.stock_count === 0).length;

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
            <h3>{robots.length}</h3>
            <p>Toplam Model</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon active">✅</div>
          <div className="admin-stat-info">
            <h3>{availableCount}</h3>
            <p>Satışta</p>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon users">⏳</div>
          <div className="admin-stat-info">
            <h3>{outOfStockCount}</h3>
            <p>Stok Tükendi</p>
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
            <h2>Robot Kataloğu</h2>
            <div className="header-actions">
              <span className="count-badge">{robots.length} model</span>
            </div>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Robot Adı</th>
                <th>Model Tipi</th>
                <th>Fiyat</th>
                <th>Stok</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {robots.map(robot => (
                <tr key={robot.id}>
                  <td>#{robot.id}</td>
                  <td className="robot-name">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {robot.ros_namespace === 'rob100' ? (
                          <img src="/robots/waffleicon.png" alt="Waffle" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                        ) : robot.ros_namespace === 'rob200' ? (
                          <img src="/robots/burgericon.png" alt="Burger" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                        ) : (
                          '🤖'
                        )}
                      </div>
                      {robot.name}
                    </div>
                  </td>
                  <td>{robot.type}</td>
                  <td>{robot.price.toLocaleString('tr-TR')} ₺</td>
                  <td>{robot.stock_count}</td>
                  <td>
                    <span className={`status-badge ${robot.is_available ? 'aktif' : 'pasif'}`}>
                      {robot.is_available ? 'Satışta' : 'Pasif'}
                    </span>
                  </td>
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
      )}
    </AdminLayout>
  );
}

export default AdminRobotsPage;
