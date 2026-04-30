import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { createRobot } from './adminApi';

function AdminRobotAddPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    type: 'AquaDrone v70',
    price: '',
    stock_count: 0,
    is_available: true,
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSelectChange = (e) => {
    setFormData(prev => ({
      ...prev,
      is_available: e.target.value === 'true',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await createRobot({
        name: formData.name,
        type: formData.type,
        price: Number(formData.price),
        stock_count: Number(formData.stock_count),
        is_available: formData.is_available,
        description: formData.description,
      });
      navigate(`/admin/robots/bilgi/${result.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <Link to="/admin/robots">Robotlar</Link>
        <span className="sep">/</span>
        <span>Yeni Robot Ekle</span>
      </div>

      <div className="admin-topbar">
        <h1>Yeni Robot Ekle</h1>
      </div>

      {error && (
        <div className="admin-table-card">
          <div className="admin-error">❌ Hata: {error}</div>
        </div>
      )}

      <div className="admin-form-card">
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label htmlFor="robot-name">Robot Adı</label>
            <input
              id="robot-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Örn: TurtleBot 3"
              required
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-type">Model Tipi</label>
            <select
              id="robot-type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#020617', border: '1px solid #334155', color: '#e5e7eb' }}
            >
              <option value="AquaDrone v70">AquaDrone v70</option>
              <option value="AeroBot X1">AeroBot X1</option>
              <option value="TerraCrawler V2">TerraCrawler V2</option>
              <option value="Sentinel Biped">Sentinel Biped</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-price">Fiyat (₺)</label>
            <input
              id="robot-price"
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-stock">Başlangıç Stok Sayısı</label>
            <input
              id="robot-stock"
              type="number"
              name="stock_count"
              value={formData.stock_count}
              onChange={handleChange}
              min="0"
              required
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-desc">Açıklama</label>
            <textarea
              id="robot-desc"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Robot hakkında kısa bilgi..."
              rows="4"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#020617', border: '1px solid #334155', color: '#e5e7eb' }}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-status">Durum</label>
            <select
              id="robot-status"
              name="is_available"
              value={String(formData.is_available)}
              onChange={handleSelectChange}
            >
              <option value="true">Satışta</option>
              <option value="false">Pasif</option>
            </select>
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="admin-btn save" disabled={saving}>
              {saving ? '⏳ Ekleniyor...' : '➕ Robotu Ekle'}
            </button>
            <Link to="/admin/robots" className="admin-btn back">
              İptal
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

export default AdminRobotAddPage;
