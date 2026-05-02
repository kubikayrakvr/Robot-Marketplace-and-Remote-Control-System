import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';
import { fetchRosRobots } from '../api/rosApi';

function ControlSelectionPage() {
  const navigate = useNavigate();
  const { ownedRobots } = useRobots();
  const [rosRobots, setRosRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRobots() {
      try {
        const data = await fetchRosRobots();
        if (!cancelled) setRosRobots(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'ROS sunucusuna bağlanılamadı.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRobots();
    // Poll the fleet status every 3 s while the page is open so the online /
    // busy badges reflect the current simulator state. The endpoint is cheap —
    // it reads from in-memory dicts on the backend.
    const id = setInterval(loadRobots, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Filter owned robots that have a valid rosRobotId
  const controllableRobots = ownedRobots.filter(r => r.rosRobotId);

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Simulasyon Baglantisi</p>
            <h1>Kontrol Paneli</h1>
            <p className="user-subtitle">
              Gazebo sunucusuna baglanmak ve kontrol etmek icin bir robot secin.
            </p>
          </div>
          <div className="user-meta">
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/user')}
            >
              Panele Don
            </button>
          </div>
        </header>

        <section className="inventory-content">
          {loading ? (
            <div className="empty-cart">
              <p>ROS bağlantısı kontrol ediliyor...</p>
            </div>
          ) : error ? (
            <div className="empty-cart">
              <div className="empty-icon">⚠️</div>
              <h2>Bağlantı Hatası</h2>
              <p>{error}</p>
            </div>
          ) : controllableRobots.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">🎮</div>
              <h2>Kontrol Edilebilir Robot Yok</h2>
              <p>
                Şu anda ROS tanımlı bir robotunuz bulunmuyor. Lütfen robotlarınızı etkinleştirin.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate('/user/robotlarim')}
              >
                Robotlarima Git
              </button>
            </div>
          ) : (
            <div className="robot-grid">
              {controllableRobots.map(robot => {
                // `rosInfo` is the fleet record from /ros/robots — present
                // when the robot's namespace is registered server-side.
                // `online` is the new live signal: true if any telemetry
                // has been observed within ONLINE_THRESHOLD_S.
                const rosInfo    = rosRobots.find(rr => rr.id === robot.rosRobotId);
                const registered = !!rosInfo;
                const isOnline   = registered && rosInfo.online;
                const isClaimed  = registered && rosInfo.session_active;

                // Three button states the user can act on:
                //   - registered & not online → "Başlat" (clicking claims,
                //     which fires the spawn signal; once telemetry flows the
                //     control panel flips out of its starting-up state).
                //   - online & free → "Bağlan".
                //   - online & busy → disabled.
                let buttonLabel = 'Bağlan';
                let buttonDisabled = false;
                if (!registered) {
                  buttonLabel = 'Bağlantı Yok';
                  buttonDisabled = true;
                } else if (isClaimed) {
                  buttonLabel = 'Meşgul';
                  buttonDisabled = true;
                } else if (!isOnline) {
                  buttonLabel = 'Başlat';
                }

                const statusText = !registered
                  ? '⚪ Sistemde Tanımsız'
                  : isOnline
                    ? '🟢 Çevrimiçi'
                    : '🟡 Çevrimdışı (başlatılabilir)';

                return (
                  <div key={robot.instanceId} className="robot-card" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div className="card-info">
                      <div className="robot-icon">{robot.icon || '🤖'}</div>
                      <div className="robot-details">
                        <h3>{robot.nickname || robot.name}</h3>
                        <p>ROS ID: {robot.rosRobotId}</p>
                        <p>Durum: {statusText}</p>
                        {isClaimed && <p style={{color: 'orange'}}>Kullanımda</p>}
                      </div>
                    </div>
                    <div className="card-actions" style={{ marginTop: '1rem' }}>
                      <button
                        className="primary-button"
                        onClick={() => navigate(`/user/kontrol/${robot.instanceId}`)}
                        disabled={buttonDisabled}
                      >
                        {buttonLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ControlSelectionPage;
