import { useNavigate } from 'react-router-dom';
import { useRobots } from '../context/RobotContext';

function MyRobotsPage() {
  const navigate = useNavigate();
  const { ownedRobots } = useRobots();

  return (
    <div className="user-page">
      <div className="user-shell">
        <header className="user-header">
          <div className="user-welcome">
            <p className="user-eyebrow">Envanter</p>
            <h1>Robotlarim</h1>
            <p className="user-subtitle">
              Satin aldiginiz robotlari goruntuleyin, aktiflestirin veya durumlarini kontrol edin.
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
          {ownedRobots.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon">📦</div>
              <h2>Henuz hic robotunuz yok.</h2>
              <p>Magazaya giderek ilk robotunuzu satin alabilirsiniz.</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => navigate('/user/shop')}
              >
                Magazaya Git
              </button>
            </div>
          ) : (
            <div className="robots-grid">
              {ownedRobots.map((robot) => {
                const isActive = robot.status === 'active';
                return (
                  <div
                    key={robot.instanceId}
                    className={`inventory-card ${isActive ? 'status-active' : 'status-inactive'}`}
                    onClick={() => {
                      if (isActive) {
                        navigate(`/user/robotlarim/bilgi/${robot.instanceId}`);
                      } else {
                        navigate(`/user/robotlarim/tanimla/${robot.instanceId}`);
                      }
                    }}
                  >
                    <div className="inventory-icon">{robot.icon}</div>
                    <div className="inventory-details">
                      <h3>{robot.name}</h3>
                      <p className="inventory-badge">
                        {isActive ? 'Aktif' : 'Onay Bekliyor'}
                      </p>
                    </div>
                    <div className="inventory-action">
                      {isActive ? 'Bilgi ➔' : 'Tanimla ➔'}
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

export default MyRobotsPage;
