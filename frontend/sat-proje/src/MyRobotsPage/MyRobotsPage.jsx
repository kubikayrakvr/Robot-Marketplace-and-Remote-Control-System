import { useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function MyRobotsPage() {
  const navigate = useNavigate();
  const { ownedRobots, loading } = useRobots();

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Envanter</p>
            <h1>Robotlarım</h1>
            <p className="user-subtitle">
              Satın aldığınız robotları görüntüleyin.
            </p>
          </div>
          <div className="user-meta">
            <button type="button" className="secondary-button" onClick={() => navigate('/user')}>
              Panele Dön
            </button>
          </div>
        </header>

        <section className="inventory-content">
          {loading ? (
            <div className="empty-cart"><div className="empty-icon">⏳</div><h2>Yükleniyor...</h2></div>
          ) : ownedRobots.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">📦</div>
              <h2>Henüz hiç robotunuz yok.</h2>
              <button type="button" className="primary-button" onClick={() => navigate('/user/shop')}>
                Mağazaya Git
              </button>
            </div>
          ) : (
            <div className="robots-grid">
              {ownedRobots.map((robot) => (
                <div
                  key={robot.instanceId}
                  className={`inventory-card status-${robot.status}`}
                  onClick={() => {
                    if (robot.status === 'inactive') {
                      navigate(`/user/robotlarim/tanimla/${robot.instanceId}`);
                    } else {
                      navigate(`/user/robotlarim/bilgi/${robot.instanceId}`);
                    }
                  }}
                >
                  <div className="inventory-icon">{robot.icon || '🤖'}</div>
                  <div className="inventory-details">
                    <h3>{robot.nickname || robot.name}</h3>
                    <p className="inventory-badge">
                      {robot.status === 'active' ? '✅ Aktif' : '⏳ Pasif'}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                      {robot.serialNumber}
                    </p>
                  </div>
                  <div className="inventory-action">
                    {robot.status === 'active' ? 'Görüntüle ➔' : 'Aktifleştir ➔'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default MyRobotsPage;
