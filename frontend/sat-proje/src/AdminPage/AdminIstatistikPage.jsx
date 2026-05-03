import { useEffect, useState, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { fetchStats } from './adminApi';

const COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa'];

function PieChart({ data, total }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 20;

    ctx.clearRect(0, 0, W, H);

    let startAngle = -Math.PI / 2;
    data.forEach((item, i) => {
      const slice = (item.gelir / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      const mid = startAngle + slice / 2;
      const lx = cx + (r * 0.65) * Math.cos(mid);
      const ly = cy + (r * 0.65) * Math.sin(mid);
      const pct = Math.round((item.gelir / total) * 100);
      if (pct > 5) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct}%`, lx, ly);
      }

      startAngle += slice;
    });
  }, [data, total]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
      <canvas ref={canvasRef} width={240} height={240} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map((item, i) => {
          const prevTotal = data.slice(0, i).reduce((acc, x) => acc + Math.round((x.gelir / total) * 100), 0);
          const pct = i === data.length - 1 ? 100 - prevTotal : Math.round((item.gelir / total) * 100);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{item.robot}</span>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: 'auto' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.adet));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {data.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{item.robot}</span>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{item.adet} adet</span>
          </div>
          <div style={{ background: '#1e293b', borderRadius: '6px', height: '12px', overflow: 'hidden' }}>
            <div style={{
              width: `${(item.adet / max) * 100}%`,
              height: '100%',
              background: COLORS[i % COLORS.length],
              borderRadius: '6px',
              transition: 'width 0.6s ease'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminIstatistikPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats()
      .then((data) => { setStats(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  return (
    <AdminLayout>
      <div className="admin-breadcrumb">
        <span>Admin</span><span className="sep">/</span><span>İstatistikler</span>
      </div>
      <div className="admin-topbar"><h1>Satış İstatistikleri</h1></div>

      {loading && <div className="admin-table-card"><div className="admin-loading">Yükleniyor...</div></div>}
      {error && <div className="admin-table-card"><div className="admin-error">❌ Hata: {error}</div></div>}

      {!loading && !error && stats && (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <div className="admin-stat-icon robots">📦</div>
              <div className="admin-stat-info"><h3>{stats.siparis_sayisi}</h3><p>Toplam Sipariş</p></div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon active">💰</div>
              <div className="admin-stat-info">
                <h3>{stats.toplam_gelir.toLocaleString('tr-TR')} ₺</h3>
                <p>Toplam Gelir</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon users">🤖</div>
              <div className="admin-stat-info">
                <h3>{stats.robot_bazli.reduce((acc, r) => acc + r.adet, 0)}</h3>
                <p>Satılan Robot</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="admin-table-card">
              <div className="admin-table-header"><h2>Gelir Dağılımı</h2></div>
	      <PieChart data={stats.robot_bazli} total={stats.toplam_gelir}/>
            </div>
            <div className="admin-table-card">
              <div className="admin-table-header"><h2>Satış Adedi</h2></div>
              <BarChart data={stats.robot_bazli} />
            </div>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-header">
              <h2>Robot Bazlı Satış</h2>
              <span className="count-badge">{stats.robot_bazli.length} model</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr><th>Robot Modeli</th><th>Satış Adedi</th><th>Gelir</th><th>Pay (%)</th></tr>
              </thead>
              <tbody>
                {stats.robot_bazli.map((r, i) => {
                  const prevTotal = stats.robot_bazli.slice(0, i).reduce((acc, x) => acc + Math.round((x.gelir / stats.toplam_gelir) * 100), 0);
                  const pct = i === stats.robot_bazli.length - 1 ? 100 - prevTotal : Math.round((r.gelir / stats.toplam_gelir) * 100);
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                          <strong>{r.robot}</strong>
                        </div>
                      </td>
                      <td>{r.adet} adet</td>
                      <td>{r.gelir.toLocaleString('tr-TR')} ₺</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            height: '8px',
                            width: `${pct}%`,
                            background: COLORS[i % COLORS.length],
                            borderRadius: '4px',
                            minWidth: '4px',
                            maxWidth: '120px'
                          }} />
                          <span>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid #334155' }}>
                  <td>TOPLAM</td>
                  <td>{stats.robot_bazli.reduce((acc, r) => acc + r.adet, 0)} adet</td>
                  <td>{stats.toplam_gelir.toLocaleString('tr-TR')} ₺</td>
                  <td>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

export default AdminIstatistikPage;
