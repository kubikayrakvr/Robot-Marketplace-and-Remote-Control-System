import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { fetchRobots, updateRobot } from './adminApi';

function AdminRobotEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    model_type: '',
    price: '',
    stock_count: '',
    is_available: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRobots()
      .then((data) => {
        const found = data.find(r => String(r.id) === String(id));
        if (!found) {
          setError('Robot bulunamadı');
        } else {
          setFormData({
            name: found.name,
            model_type: found.model_type,
            price: found.price,
            stock_count: found.stock_count,
            is_available: found.is_available,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
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
      await updateRobot(id, {
        name: formData.name,
        model_type: formData.model_type,
        price: Number(formData.price),
        stock_count: Number(formData.stock_count),
        is_available: formData.is_available,
      });
      navigate(`/admin/robots/bilgi/${id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
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

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <Link to="/admin/robots">Robotlar</Link>
        <span className="sep">/</span>
        <Link to={`/admin/robots/bilgi/${id}`}>{formData.name}</Link>
        <span className="sep">/</span>
        <span>Düzenle</span>
      </div>

      <div className="admin-topbar">
        <h1>Robotu Düzenle</h1>
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
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-model">Model Tipi</label>
            <input
              id="robot-model"
              type="text"
              name="model_type"
              value={formData.model_type}
              onChange={handleChange}
            />
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
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-stock">Stok Adedi</label>
            <input
              id="robot-stock"
              type="number"
              name="stock_count"
              value={formData.stock_count}
              onChange={handleChange}
              min="0"
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
              {saving ? '⏳ Kaydediliyor...' : '💾 Değişiklikleri Kaydet'}
            </button>
            <Link to={`/admin/robots/bilgi/${id}`} className="admin-btn back">
              İptal
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

export default AdminRobotEditPage;
