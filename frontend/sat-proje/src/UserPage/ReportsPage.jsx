import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReport, fetchMyReports } from '../api/userApi';

function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await fetchMyReports();
      setReports(data);
    } catch (err) {
      console.error('Raporlar yuklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return;
    
    setSubmitting(true);
    setMsg({ text: '', type: '' });
    try {
      await createReport(formData);
      setMsg({ text: 'Raporunuz başarıyla iletildi.', type: 'success' });
      setFormData({ title: '', description: '' });
      loadReports();
    } catch (err) {
      setMsg({ text: err.message || 'Rapor iletilemedi.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Destek</p>
            <h1>Hata Bildir / Rapor Oluştur</h1>
          </div>
          <button className="secondary-button" onClick={() => navigate('/user')}>
            Geri Dön
          </button>
        </header>

        <div className="user-grid" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
          {/* Form */}
          <div className="user-card">
            <h2 style={{ marginBottom: '1.5rem', color: '#fff' }}>Yeni Rapor</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Başlık</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Sorunun kısa özeti"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: '#0f172a', border: '1px solid #1e293b', color: '#fff' }}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Detaylı Açıklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Lütfen sorunu detaylıca açıklayın..."
                  rows="5"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: '#0f172a', border: '1px solid #1e293b', color: '#fff', resize: 'none' }}
                  required
                />
              </div>
              
              {msg.text && (
                <div style={{ padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', background: msg.type === 'success' ? '#065f4633' : '#991b1b33', color: msg.type === 'success' ? '#34d399' : '#f87171', fontSize: '0.9rem' }}>
                  {msg.text}
                </div>
              )}

              <button 
                type="submit" 
                className="primary-button" 
                style={{ width: '100%' }}
                disabled={submitting}
              >
                {submitting ? 'Gönderiliyor...' : 'Raporu Gönder'}
              </button>
            </form>
          </div>

          {/* Past Reports */}
          <div className="user-card">
            <h2 style={{ marginBottom: '1.5rem', color: '#fff' }}>Önceki Raporlarım</h2>
            {loading ? (
              <p style={{ color: '#94a3b8' }}>Yükleniyor...</p>
            ) : reports.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Henüz bir rapor oluşturmadınız.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reports.map((report) => (
                  <div key={report.id} style={{ padding: '1rem', borderRadius: '0.5rem', background: '#0f172a', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ color: '#fff', margin: 0 }}>{report.title}</h4>
                      <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: report.is_resolved ? '#065f46' : '#991b1b', color: '#fff' }}>
                        {report.is_resolved ? 'Çözüldü' : 'Beklemede'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 0.5rem 0' }}>{report.description}</p>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(report.created_at).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
