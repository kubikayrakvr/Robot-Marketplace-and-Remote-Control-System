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
              Baglanmak ve kontrol etmek icin bir robot secin.
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

                // Battery: prefer the live ROS view (tracks despawned-but-saved
                // values), fall back to whatever /api/user-robots/ shipped.
                const batteryPct = (rosInfo && typeof rosInfo.battery_pct === 'number')
                  ? rosInfo.battery_pct
                  : (typeof robot.batteryPct === 'number' ? robot.batteryPct : null);
                const batteryFlat = batteryPct != null && batteryPct <= 0;

                // Button states:
                //   - registered & not online → "Başlat" (claim spawns).
                //   - online & free → "Bağlan".
                //   - online & busy → disabled.
                //   - battery == 0 → "Şarj Gerekli" (disabled regardless).
                let buttonLabel = 'Bağlan';
                let buttonDisabled = false;
                if (!registered) {
                  buttonLabel = 'Bağlantı Yok';
                  buttonDisabled = true;
                } else if (batteryFlat) {
                  buttonLabel = 'Şarj Gerekli';
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

                const batteryColor =
                  batteryPct == null ? '#64748b' :
                  batteryPct <= 15 ? '#ef4444' :
                  batteryPct <= 35 ? '#f59e0b' : '#4ade80';
                const batteryIcon =
                  batteryPct == null ? '🔌' :
                  batteryPct <= 15 ? '🪫' : '🔋';

                // Sensor chips give the user an at-a-glance summary of
                // what each robot can do, before they click into the
                // control panel. Backend supplies the array; we map to
                // emoji + Turkish label for the visible tag.
                const sensorChips = [
                  { key: 'camera', icon: '📷', label: 'Kamera' },
                  { key: 'scan',   icon: '🎯', label: 'LIDAR' },
                  { key: 'imu',    icon: '🧭', label: 'IMU' },
                ];

                return (
                  <div key={robot.instanceId} className="panel robot-card">
                    <div className="card-info">
                      <div className="robot-icon">
                        {robot.icon && robot.icon.startsWith('/') ? (
                          <img src={robot.icon} alt="icon" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        ) : (
                          robot.icon || '🤖'
                        )}
                      </div>
                      <div className="robot-details">
                        <h3>{robot.nickname || robot.name}</h3>
                        <p className="robot-meta">ROS ID: <span className="ns-tag-inline">{robot.rosRobotId}</span></p>
                        <p className="robot-meta">{statusText}</p>
                        <p className="robot-meta" style={{ color: batteryColor }}>
                          {batteryIcon} Batarya: {batteryPct != null ? `${Math.round(batteryPct)}%` : '—'}
                        </p>
                        {isClaimed && <p className="robot-busy">Kullanımda</p>}
                        {registered && (
                          <div className="sensor-chips">
                            {sensorChips.map(c => (
                              <span
                                key={c.key}
                                className={`sensor-chip ${(rosInfo.sensors || []).includes(c.key) ? 'have' : 'lack'}`}
                                title={(rosInfo.sensors || []).includes(c.key) ? `${c.label} mevcut` : `${c.label} yok`}
                              >
                                {c.icon} {c.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="card-actions">
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
