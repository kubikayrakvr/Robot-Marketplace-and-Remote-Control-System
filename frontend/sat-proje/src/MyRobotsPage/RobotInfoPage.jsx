import { useNavigate, useParams } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function RobotInfoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { ownedRobots } = useRobots();

  const robot = ownedRobots.find((r) => r.instanceId === id);

  if (!robot) {
    return (
      <div className="user-page">
        <div className="user-shell">
          <h2>Robot bulunamadı.</h2>
          <button className="secondary-button" onClick={() => navigate('/user/robotlarim')}>
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Durum Paneli</p>
            <h1>{robot.nickname || robot.name}</h1>
            <p className="user-subtitle">{robot.description}</p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user/robotlarim')}
            >
              Robotlara Dön
            </button>
          </div>
        </header>

        <section className="robot-info-content">
          <div className="info-card">
            <div className="info-icon">
              {robot.icon && robot.icon.startsWith('/') ? (
                <img src={robot.icon} alt="icon" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              ) : (
                robot.icon || '🤖'
              )}
            </div>
            <div className="info-stats">
              <div className="stat-box">
                <span className="stat-label">Durum</span>
                <span className="stat-value">{robot.status === 'active' ? '✅ Aktif' : '⏳ Pasif'}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Seri No</span>
                <span className="stat-value">{robot.serialNumber}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Aktivasyon Kodu</span>
                <span className="stat-value" style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {robot.activationCode || '—'}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">ROS ID</span>
                <span className="stat-value">{robot.rosRobotId || 'Tanımlanmadı'}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Garanti Süresi</span>
                <span className="stat-value">{robot.warrantyMonths || 24} Ay</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Garanti Bitiş</span>
                <span className="stat-value">
                  {robot.warrantyEnd
                    ? new Date(robot.warrantyEnd).toLocaleDateString('tr-TR')
                    : '—'}
                </span>
              </div>
            </div>
            <div className="info-actions">
              {robot.rosRobotId && (
                <button
                  className="primary-button"
                  onClick={() => navigate(`/user/kontrol/${robot.instanceId}`)}
                >
                  Kontrol Paneline Git
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default RobotInfoPage;
