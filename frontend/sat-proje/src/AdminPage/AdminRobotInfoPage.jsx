import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { fetchRobots, generateInventory } from './adminApi';

function AdminRobotInfoPage() {
  const { id } = useParams();
  const [robot, setRobot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [invQty, setInvQty] = useState(1);
  const [invLoading, setInvLoading] = useState(false);
  const [invMsg, setInvMsg] = useState('');

  useEffect(() => {
    fetchRobots()
      .then((data) => {
        const found = data.find(r => String(r.id) === String(id));
        if (!found) {
          setError('Robot bulunamadı');
        } else {
          setRobot(found);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleCreateInventory = async () => {
    setInvLoading(true);
    setInvMsg('');
    try {
      const result = await generateInventory({ model_id: Number(id), quantity: invQty });
      setInvMsg(`✅ ${result.length} adet envanter oluşturuldu.`);
    } catch (err) {
      setInvMsg(`❌ ${err.message}`);
    } finally {
      setInvLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-table-card">
          <div className="admin-loading">Yükleniyor...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !robot) {
    return (
      <AdminLayout>
        <div className="admin-table-card">
          <div className="admin-error">❌ Hata: {error || 'Robot bulunamadı'}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <Link to="/admin/robots">Robotlar</Link>
        <span className="sep">/</span>
        <span>{robot.name}</span>
      </div>

      <div className="admin-detail-hero">
        <div className="admin-detail-avatar robot-avatar">🤖</div>
        <div className="admin-detail-title">
          <h1>{robot.name}</h1>
          <p>Model: {robot.type} &middot; ID: #{robot.id}</p>
          <div className="admin-detail-actions">
            <Link to={`/admin/robots/duzenle/${id}`} className="admin-btn edit">✏️ Düzenle</Link>
            <Link to="/admin/robots" className="admin-btn back">← Geri Dön</Link>
          </div>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-detail-card">
          <h3>🔧 Genel Bilgiler</h3>
          <div className="detail-row">
            <span className="detail-label">Robot ID</span>
            <span className="detail-value">#{robot.id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Robot Adı</span>
            <span className="detail-value">{robot.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Model Tipi</span>
            <span className="detail-value">{robot.type}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">ROS Namespace</span>
            <span className="detail-value">{robot.ros_namespace || '—'}</span>
          </div>
        </div>

        <div className="admin-detail-card">
          <h3>📊 Satış Bilgileri</h3>
          <div className="detail-row">
            <span className="detail-label">Fiyat</span>
            <span className="detail-value">{robot.price.toLocaleString('tr-TR')} ₺</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Stok Adedi</span>
            <span className="detail-value">{robot.stock_count}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Durum</span>
            <span className={`status-badge ${robot.is_available ? 'aktif' : 'pasif'}`}>
              {robot.is_available ? 'Satışta' : 'Pasif'}
            </span>
          </div>
        </div>

        <div className="admin-detail-card">
          <h3>📦 Envanter Oluştur</h3>
          <div className="detail-row">
            <span className="detail-label">Adet</span>
            <input
              type="number"
              min="1"
              max="100"
              value={invQty}
	      onChange={(e) => setInvQty(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #334155' }}
            />
          </div>
          <button
            className="admin-btn edit"
            onClick={handleCreateInventory}
            disabled={invLoading}
            style={{ marginTop: '12px' }}
          >
            {invLoading ? 'Oluşturuluyor...' : '➕ Envanter Oluştur'}
          </button>
          {invMsg && <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>{invMsg}</p>}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminRobotInfoPage;
