import { useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function ControlSelectionPage() {
  const navigate = useNavigate();
  const { ownedRobots } = useRobots();

  // Sadece aktif (onaylanmis) robotlari filtrele
  const activeRobots = ownedRobots.filter((r) => r.status === 'active');

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Simulasyon Baglantisi</p>
            <h1>Kontrol Paneli</h1>
            <p className="user-subtitle">
              Gazebo sunucusuna baglanmak ve kontrol etmek istediginiz aktif robotunuzu secin.
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
          {activeRobots.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">🎮</div>
              <h2>Kontrol edilebilir robot bulunamadi.</h2>
              <p>Öncelikle magaza uzerinden bir robot alip "Robotlarim" kismindan aktiflestirmelisiniz.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate('/user/robotlarim')}
              >
                Robotlarima Git
              </button>
            </div>
          ) : (
            <div className="robots-grid">
              {activeRobots.map((robot) => (
                <div
                  key={robot.instanceId}
                  className="inventory-card status-active"
                  onClick={() => navigate(`/user/kontrol/${robot.instanceId}`)}
                >
                  <div className="inventory-icon">{robot.icon}</div>
                  <div className="inventory-details">
                    <h3>{robot.name}</h3>
                    <p className="inventory-badge">Gazebo Icin Hazir</p>
                  </div>
                  <div className="inventory-action">Baglan ➔</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ControlSelectionPage;
