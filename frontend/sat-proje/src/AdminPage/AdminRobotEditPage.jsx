import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';

function AdminRobotEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: id === '1' ? 'Robot Alpha' : id === '2' ? 'Robot Beta' : id === '3' ? 'Robot Gamma' : 'Robot Delta',
    model: id === '1' ? 'RA-100' : id === '2' ? 'RB-200' : id === '3' ? 'RG-300' : 'RD-400',
    status: id === '2' ? 'Beklemede' : id === '3' ? 'Pasif' : 'Aktif',
    owner: id === '1' ? 'Altan Turan' : id === '2' ? 'Veli Yılmaz' : id === '3' ? 'Ayşe Kaya' : 'Mehmet Demir',
    serialNumber: `SN-${id}23456`,
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Robot ID ${id} başarıyla güncellendi!`);
    navigate(`/admin/robots/bilgi/${id}`);
  };

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
            <label htmlFor="robot-model">Model</label>
            <input
              id="robot-model"
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-serial">Seri Numarası</label>
            <input
              id="robot-serial"
              type="text"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-status">Durum</label>
            <select
              id="robot-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="Aktif">Aktif</option>
              <option value="Beklemede">Beklemede</option>
              <option value="Pasif">Pasif</option>
            </select>
          </div>

          <div className="admin-form-group">
            <label htmlFor="robot-owner">Sahip</label>
            <input
              id="robot-owner"
              type="text"
              name="owner"
              value={formData.owner}
              onChange={handleChange}
            />
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="admin-btn save">
              💾 Değişiklikleri Kaydet
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
