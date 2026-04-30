import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { fetchAdminReports, resolveReport } from './adminApi';

function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('unresolved'); // 'unresolved' | 'resolved'
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReports();
  }, [activeTab]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const isResolved = activeTab === 'resolved';
      const data = await fetchAdminReports(isResolved);
      setReports(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id) => {
    if (!window.confirm('Bu raporu çözüldü olarak işaretlemek istiyor musunuz?')) return;
    try {
      await resolveReport(id);
      loadReports();
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <span>Admin</span>
        <span className="sep">/</span>
        <span>Kullanıcı Raporları</span>
      </div>

      <div className="admin-topbar">
        <h1>Rapor Yönetimi</h1>
      </div>

      <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('unresolved')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'unresolved' ? '#38bdf8' : '#64748b',
            fontWeight: activeTab === 'unresolved' ? 'bold' : 'normal',
            borderBottom: activeTab === 'unresolved' ? '2px solid #38bdf8' : 'none',
            padding: '0.5rem 1rem',
            cursor: 'pointer'
          }}
        >
          Bekleyen Raporlar
        </button>
        <button 
          onClick={() => setActiveTab('resolved')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activeTab === 'resolved' ? '#10b981' : '#64748b',
            fontWeight: activeTab === 'resolved' ? 'bold' : 'normal',
            borderBottom: activeTab === 'resolved' ? '2px solid #10b981' : 'none',
            padding: '0.5rem 1rem',
            cursor: 'pointer'
          }}
        >
          Çözülmüş Raporlar
        </button>
      </div>

      {loading ? (
        <div className="admin-table-card">
          <div className="admin-loading">Yükleniyor...</div>
        </div>
      ) : error ? (
        <div className="admin-table-card">
          <div className="admin-error">❌ Hata: {error}</div>
        </div>
      ) : reports.length === 0 ? (
        <div className="admin-table-card">
          <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            {activeTab === 'unresolved' ? 'Bekleyen rapor bulunmuyor.' : 'Henüz çözülmüş rapor yok.'}
          </p>
        </div>
      ) : (
        <div className="admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Kullanıcı</th>
                <th>Başlık</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>#{report.id}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff' }}>{report.username}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {report.user_id}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff' }}>{report.title}</span>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{report.description}</span>
                    </div>
                  </td>
                  <td>{new Date(report.created_at).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <span className={`status-badge ${report.is_resolved ? 'aktif' : 'pasif'}`}>
                      {report.is_resolved ? 'Çözüldü' : 'Beklemede'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {/* Detay modalı veya ayrı sayfa eklenebilir, şimdilik direkt çözme butonu */}
                      {!report.is_resolved && (
                        <button 
                          className="admin-btn edit" 
                          onClick={() => handleResolve(report.id)}
                        >
                          ✅ Çözüldü
                        </button>
                      )}
                      {report.is_resolved && (
                         <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                           {new Date(report.resolved_at).toLocaleDateString('tr-TR')} tarihinde çözüldü
                         </span>
                      )}
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

export default AdminReportsPage;
