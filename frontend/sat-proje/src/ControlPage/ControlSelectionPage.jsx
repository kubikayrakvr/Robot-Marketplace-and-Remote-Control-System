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
    async function loadRobots() {
      try {
        const data = await fetchRosRobots();
        setRosRobots(data);
      } catch (err) {
        setError(err.message || 'ROS sunucusuna bağlanılamadı.');
      } finally {
        setLoading(false);
      }
    }
    loadRobots();
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
                const rosInfo = rosRobots.find(rr => rr.id === robot.rosRobotId);
                const isOnline = !!rosInfo;
                const isClaimed = isOnline && rosInfo.session_active;

                return (
                  <div key={robot.instanceId} className="robot-card" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '1rem' }}>
                    <div className="card-info">
                      <div className="robot-icon">{robot.icon || '🤖'}</div>
                      <div className="robot-details">
                        <h3>{robot.nickname || robot.name}</h3>
                        <p>ROS ID: {robot.rosRobotId}</p>
                        <p>Durum: {isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'}</p>
                        {isClaimed && <p style={{color: 'orange'}}>Kullanımda</p>}
                      </div>
                    </div>
                    <div className="card-actions" style={{ marginTop: '1rem' }}>
                      <button
                        className="primary-button"
                        onClick={() => navigate(`/user/kontrol/${robot.instanceId}`)}
                        disabled={!isOnline || isClaimed}
                      >
                        {!isOnline ? 'Bağlantı Yok' : isClaimed ? 'Meşgul' : 'Bağlan'}
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
