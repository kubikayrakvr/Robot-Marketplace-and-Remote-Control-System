import React from 'react';
import { useParams, Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';

const fakeRobotData = {
  '1': { name: 'Robot Alpha', model: 'RA-100', status: 'Aktif', owner: 'Altan Turan', serialNumber: 'SN-123456', specs: 'Mekanik Kollar, Tekerlekli Sürüş', registeredAt: '2026-01-15', firmware: 'v3.2.1', lastOnline: '2026-04-28 14:32' },
  '2': { name: 'Robot Beta', model: 'RB-200', status: 'Beklemede', owner: 'Veli Yılmaz', serialNumber: 'SN-223456', specs: '6-Eksenli Kol, Lazer Sensör', registeredAt: '2026-02-20', firmware: 'v2.8.0', lastOnline: '2026-04-25 09:15' },
  '3': { name: 'Robot Gamma', model: 'RG-300', status: 'Pasif', owner: 'Ayşe Kaya', serialNumber: 'SN-323456', specs: 'Paletli Sürüş, Kamera Modülü', registeredAt: '2026-03-10', firmware: 'v4.0.0', lastOnline: '2026-04-20 18:44' },
  '4': { name: 'Robot Delta', model: 'RD-400', status: 'Aktif', owner: 'Mehmet Demir', serialNumber: 'SN-423456', specs: 'Drone Modülü, GPS Navigasyon', registeredAt: '2026-04-05', firmware: 'v3.5.2', lastOnline: '2026-04-28 16:00' },
};

function getStatusClass(status) {
  if (status === 'Aktif') return 'aktif';
  if (status === 'Beklemede') return 'beklemede';
  return 'pasif';
}

function AdminRobotInfoPage() {
  const { id } = useParams();
  const robot = fakeRobotData[id] || fakeRobotData['1'];

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <Link to="/admin/robots">Robotlar</Link>
        <span className="sep">/</span>
        <span>{robot.name}</span>
      </div>

      {/* Hero */}
      <div className="admin-detail-hero">
        <div className="admin-detail-avatar robot-avatar">🤖</div>
        <div className="admin-detail-title">
          <h1>{robot.name}</h1>
          <p>Model: {robot.model} &middot; Seri No: {robot.serialNumber}</p>
          <div className="admin-detail-actions">
            <Link to={`/admin/robots/duzenle/${id}`} className="admin-btn edit">✏️ Düzenle</Link>
            <Link to="/admin/robots" className="admin-btn back">← Geri Dön</Link>
          </div>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="admin-detail-grid">
        <div className="admin-detail-card">
          <h3>🔧 Genel Bilgiler</h3>
          <div className="detail-row">
            <span className="detail-label">Robot ID</span>
            <span className="detail-value">#{id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Robot Adı</span>
            <span className="detail-value">{robot.name}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Model</span>
            <span className="detail-value">{robot.model}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Seri Numarası</span>
            <span className="detail-value">{robot.serialNumber}</span>
          </div>
        </div>

        <div className="admin-detail-card">
          <h3>📊 Durum & Sahiplik</h3>
          <div className="detail-row">
            <span className="detail-label">Durum</span>
            <span className={`status-badge ${getStatusClass(robot.status)}`}>{robot.status}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Sahip</span>
            <span className="detail-value">{robot.owner}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Kayıt Tarihi</span>
            <span className="detail-value">{robot.registeredAt}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Son Çevrimiçi</span>
            <span className="detail-value">{robot.lastOnline}</span>
          </div>
        </div>

        <div className="admin-detail-card full-width">
          <h3>⚡ Teknik Detaylar</h3>
          <div className="detail-row">
            <span className="detail-label">Özellikler</span>
            <span className="detail-value">{robot.specs}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Firmware Versiyonu</span>
            <span className="detail-value">{robot.firmware}</span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminRobotInfoPage;
